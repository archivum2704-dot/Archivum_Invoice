import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  current_org_id: string | null;
}

interface Organization {
  id: string;
  name: string;
  access_code: string | null;
  cif: string | null;
}

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  org: Organization | null;
  orgId: string | null;
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
  const [loading,  setLoading]  = useState(true);

  const orgId = profile?.current_org_id ?? null;

  /* ── Load profile + org ────────────────────────────────────────────────── */
  const loadProfile = async (userId: string) => {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, current_org_id")
      .eq("id", userId)
      .single();

    if (!p) return;
    setProfile(p);

    if (p.current_org_id) {
      const { data: o } = await supabase
        .from("organizations")
        .select("id, name, access_code, cif")
        .eq("id", p.current_org_id)
        .single();
      setOrg(o ?? null);
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

  /* ── Sign in Empresa (owner/admin) ─────────────────────────────────────── */
  const signInEmpresa = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  /* ── Sign in Usuario (member with company code) ─────────────────────────── */
  const signInUsuario = async (email: string, password: string, code: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;

    const upperCode = code.trim().toUpperCase();
    const { data: orgData } = await supabase
      .from("organizations")
      .select("id, name, access_code, cif")
      .eq("access_code", upperCode)
      .single();

    if (!orgData) {
      await supabase.auth.signOut();
      return "Código de empresa no encontrado o no eres miembro de esta organización.";
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").update({ current_org_id: orgData.id }).eq("id", user.id);
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
    await supabase.auth.signOut();
    setProfile(null);
    setOrg(null);
  };

  return (
    <AuthContext.Provider value={{
      session, profile, org, orgId, loading,
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
