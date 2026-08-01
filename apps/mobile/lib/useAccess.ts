import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import type { AccessContext } from "@/lib/permissions";

/**
 * Builds the context the permission table is evaluated against.
 *
 * Admins reach every client by definition, so their per-client grants are never
 * fetched — the lookup only runs for members, where it decides whether
 * uploading is possible at all.
 */
export function useAccessContext(): { ctx: AccessContext; loading: boolean } {
  const { orgId, role, isAdmin, isPlatformAdmin } = useAuth();
  const isViewer = !isPlatformAdmin && role === "viewer";
  const needsLookup = !!orgId && !isAdmin && !isViewer;

  const [canUpload, setCanUpload] = useState(false);
  const [loading, setLoading] = useState(needsLookup);

  useEffect(() => {
    if (!needsLookup) {
      setCanUpload(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("company_user_access")
      .select("can_upload")
      .eq("organization_id", orgId!)
      .then(({ data }) => {
        if (cancelled) return;
        setCanUpload((data ?? []).some((r: { can_upload: boolean }) => r.can_upload));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [needsLookup, orgId]);

  return {
    ctx: {
      isPlatformAdmin,
      isOrgAdmin: isAdmin,
      isViewer,
      canUploadSomewhere: isAdmin || canUpload,
    },
    loading,
  };
}
