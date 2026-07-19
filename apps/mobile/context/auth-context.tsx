import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Alert } from "react-native";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "@archivum/device_session_id";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  current_org_id: string | null;
  platform_role: string | null;
}

interface Organization {
  id: string;
  name: string;
  access_code: string | null;
  cif: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  org: Organization | null;
  orgId: string | null;
  role: string | null;
  isPlatformAdmin: boolean;
  isAdmin: boolean;
  isPaid: boolean;
  loading: boolean;
  signInEmpresa: (email: string, password: string) => Promise<string | null>;
  signInUsuario: (email: string, password: string, code: string) => Promise<string | null>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,  setSession]  = useState<Session | null>(null);
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [org,      setOrg]      = useState<Organization | null>(null);
  const [role,     setRole]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  const orgId = profile?.current_org_id ?? null;
  const isPlatformAdmin = profile?.platform_role === "super_admin";
  const isAdmin = isPlatformAdmin || role === "owner" || role === "admin";
  const INACTIVE = ["canceled", "unpaid", "incomplete"];
  const isPaid =
    !!org && org.subscription_plan !== "free" && !!org.subscription_plan &&
    !INACTIVE.includes(org.subscription_status ?? "");

  /* ── Load profile + org + single-device check ──────────────────────────── */
  const loadProfile = async (userId: string) => {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, current_org_id, platform_role, active_session_id")
      .eq("id", userId)
      .single();

    if (!p) return;

    // ── Single-device enforcement ──────────────────────────────────────────
    const localSid = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);

    if (p.active_session_id && localSid && p.active_session_id !== localSid) {
      // Another device has logged in — kick this session
      await supabase.auth.signOut();
      await AsyncStorage.removeItem(SESSION_KEY);
      Alert.alert(
        "Sesión cerrada",
        "Tu cuenta ha iniciado sesión en otro dispositivo. Por seguridad, esta sesión ha sido cerrada.",
        [{ text: "Entendido" }]
      );
      return;
    }

    setProfile(p);

    if (p.current_org_id) {
      const { data: o } = await supabase
        .from("organizations")
        .select("id, name, access_code, cif, subscription_plan, subscription_status")
        .eq("id", p.current_org_id)
        .single();
      setOrg(o ?? null);

      const { data: m } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", p.current_org_id)
        .eq("user_id", userId)
        .maybeSingle();
      setRole(m?.role ?? null);
    }
  };

  const refreshProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await loadProfile(user.id);
  };

  /* ── Auth state listener ───────────────────────────────────────────────── */
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setOrg(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /* ── Register single-device session ────────────────────────────────────── */
  const registerDeviceSession = async (userId: string) => {
    const sessionId = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    await AsyncStorage.setItem(SESSION_KEY, sessionId).catch(() => {});
    await supabase.from("profiles").update({ active_session_id: sessionId }).eq("id", userId);
  };

  /* ── Sign in Empresa (owner/admin) ─────────────────────────────────────── */
  const signInEmpresa = async (email: string, password: string) => {
    // Drop any stale device-session id BEFORE signing in: the auth listener
    // fires loadProfile immediately, and a leftover id from a previous session
    // would trip the single-device check and kick this fresh login.
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    if (data.user) await registerDeviceSession(data.user.id);
    return null;
  };

  /* ── Sign in Usuario (member with company code) ─────────────────────────── */
  const signInUsuario = async (email: string, password: string, code: string) => {
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    const upperCode = code.trim().toUpperCase();
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name, access_code, cif, subscription_plan, subscription_status")
      .eq("access_code", upperCode)
      .single();

    if (!orgData) {
      await supabase.auth.signOut();
      return "Código de empresa no encontrado o no eres miembro de esta organización.";
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ current_org_id: orgData.id }).eq("id", user.id);
      if (data.user) await registerDeviceSession(user.id);
    }
    setOrg(orgData);
    return null;
  };

  /* ── Sign up ────────────────────────────────────────────────────────────── */
  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
      },
    });
    return error?.message ?? null;
  };

  /* ── Sign out ───────────────────────────────────────────────────────────── */
  const signOut = async () => {
    await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
    await supabase.auth.signOut();
    setProfile(null);
    setOrg(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{
      session, profile, org, orgId, role, isPlatformAdmin, isAdmin, isPaid, loading,
      signInEmpresa, signInUsuario, signUp, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
