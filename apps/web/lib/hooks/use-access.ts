import { useOrganization } from '@/lib/context/organization-context'
import { useMemberCompanyAccess } from '@/lib/hooks/use-members'
import type { AccessContext } from '@/lib/permissions'

/**
 * Builds the context the permission table is evaluated against.
 *
 * Admins reach every client by definition, so their per-client grants are never
 * fetched — the lookup only runs for members and viewers, where it decides
 * whether uploading is possible at all.
 */
export function useAccessContext(): { ctx: AccessContext; loading: boolean } {
  const { currentOrg, userProfile, isPlatformAdmin, isOrgAdmin, isViewer, loading } = useOrganization()

  const needsLookup = !isOrgAdmin && !isViewer
  const { access, loading: accessLoading } = useMemberCompanyAccess(
    needsLookup ? currentOrg?.id ?? null : null,
    needsLookup ? userProfile?.id ?? null : null,
  )

  return {
    ctx: {
      isPlatformAdmin,
      isOrgAdmin,
      isViewer,
      canUploadSomewhere: isOrgAdmin || access.some(a => a.can_upload),
    },
    loading: loading || (needsLookup && accessLoading),
  }
}
