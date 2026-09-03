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
  logo_url: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
}

type SignInResult = { error: string | null; mfaRequired: boolean };

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
  /** True once password sign-in succeeds but the account has a verified TOTP
   * factor still awaiting its challenge — mirrors the web's aal1→aal2 gate. */
  mfaPending: boolean;
  signInEmpresa: (email: string, password: string) => Promise<SignInResult>;
  signInUsuario: (email: string, password: string, code: string) => Promise<SignInResult>;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  verifyMfaCode: (code: string) => Promise<string | null>;
  cancelMfa: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session,    setSession]    = useState<Session | null>(null);
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [org,        setOrg]        = useState<Organization | null>(null);
  const [role,       setRole]       = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [mfaPending, setMfaPending] = useState(false);

  /** Reads currentLevel/nextLevel off the live session — aal2 is only ever
   * reached after `mfa.challengeAndVerify`, so a mismatch means a verified
   * TOTP factor is still owed a challenge. */
  const checkMfaPending = async () => {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const pending = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel;
    setMfaPending(pending);
    return pending;
  };

  const orgId = profile?.current_org_id ?? null;
  const isPlatformAdmin = profile?.platform_role === "super_admin";
  const isAdmin = isPlatformAdmin || role === "owner" || role === "admin";
  const INACTIVE = ["canceled", "unpaid", "incomplete"];
  const isPaid =
    !!org && org.subscription_plan !== "free" && !!org.subscription_plan &&
    !INACTIVE.includes(org.subscription_status ?? "");

  /* ── Load profile + org + single-device check ──────────────────────────── */
  // Called after every sign-in and after the MFA challenge, both times right
  // before the caller clears its own `loading` flag — a thrown network error
  // here (as opposed to a returned {error}) used to skip that, leaving the
  // app stuck on its loading screen with no way forward.
  const loadProfile = async (userId: string) => {
    try {
      await loadProfileUnsafe(userId);
    } catch (e) {
      console.warn("[auth] loadProfile failed:", e);
    }
  };

  const loadProfileUnsafe = async (userId: string) => {
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
        .select("id, name, access_code, cif, logo_url, subscription_plan, subscription_status")
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
      if (session?.user) {
        await checkMfaPending();
        await loadProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await checkMfaPending();
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setOrg(null);
          setMfaPending(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  /* ── Register single-device session ────────────────────────────────────── */
  const registerDeviceSession = async (userId: string) => {
    // Revokes every other session's refresh token server-side (web included).
    // active_session_id below only trips the *other* device's check the next
    // time it loads a profile — this is what makes a leaked or previously
    // shared login (e.g. a temporary password) actually stop working there
    // instead of merely getting redirected next time it happens to be used.
    await supabase.auth.signOut({ scope: "others" });
    const sessionId = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    await AsyncStorage.setItem(SESSION_KEY, sessionId).catch(() => {});
    await supabase.from("profiles").update({ active_session_id: sessionId }).eq("id", userId);
  };

  /* ── Sign in Empresa (owner/admin) ─────────────────────────────────────── */
  const signInEmpresa = async (email: string, password: string): Promise<SignInResult> => {
    try {
      // Drop any stale device-session id BEFORE signing in: the auth listener
      // fires loadProfile immediately, and a leftover id from a previous session
      // would trip the single-device check and kick this fresh login.
      await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, mfaRequired: false };
      if (data.user) await registerDeviceSession(data.user.id);
      const mfaRequired = await checkMfaPending();
      return { error: null, mfaRequired };
    } catch {
      return { error: "No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.", mfaRequired: false };
    }
  };

  /* ── Sign in Usuario (member with company code) ─────────────────────────── */
  const signInUsuario = async (email: string, password: string, code: string): Promise<SignInResult> => {
    try {
      await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message, mfaRequired: false };

      const upperCode = code.trim().toUpperCase();
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, access_code, cif, logo_url, subscription_plan, subscription_status")
        .eq("access_code", upperCode)
        .single();

      if (!orgData) {
        await supabase.auth.signOut();
        return { error: "Código de empresa no encontrado o no eres miembro de esta organización.", mfaRequired: false };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("profiles").update({ current_org_id: orgData.id }).eq("id", user.id);
        if (data.user) await registerDeviceSession(user.id);
      }
      setOrg(orgData);
      const mfaRequired = await checkMfaPending();
      return { error: null, mfaRequired };
    } catch {
      return { error: "No se pudo iniciar sesión. Comprueba tu conexión e inténtalo de nuevo.", mfaRequired: false };
    }
  };

  /* ── Two-factor challenge (TOTP) ────────────────────────────────────────── */
  const verifyMfaCode = async (code: string) => {
    // A dropped connection makes these throw instead of resolving with
    // {error} — without a catch, the caller's `loading` state never clears
    // and the screen is stuck spinning with no way forward but a force-quit.
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp.find(f => f.status === "verified");
      if (error || !factor) return "No hay ninguna verificación en dos pasos activa en esta cuenta.";
      const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verifyErr) return "Código incorrecto. Inténtalo de nuevo.";
      setMfaPending(false);
      return null;
    } catch {
      return "No se pudo verificar el código. Comprueba tu conexión e inténtalo de nuevo.";
    }
  };

  /** Bails out of a pending challenge by signing out entirely — there is no
   * partial session to fall back to, same as "Cerrar sesión" on the web
   * challenge screen. */
  const cancelMfa = async () => {
    await signOut();
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
      session, profile, org, orgId, role, isPlatformAdmin, isAdmin, isPaid, loading, mfaPending,
      signInEmpresa, signInUsuario, signUp, signOut, refreshProfile, verifyMfaCode, cancelMfa,
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
