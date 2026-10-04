-- ============================================================================
-- Vaciar una cuenta de pruebas — PASO 1: REVISAR (solo lectura, no cambia nada)
-- ============================================================================
-- Pega ESTE fichero entero en una pestaña nueva del SQL Editor y pulsa Run.
-- Muestra la cuenta, sus organizaciones y cuántas filas tiene cada una.
-- Después del paso 2, vuelve a ejecutarlo: todo debería salir a 0.
-- ============================================================================

WITH u AS (
  SELECT id, email FROM auth.users WHERE lower(email) = lower('archivum2704@gmail.com')
)
SELECT u.email, u.id AS user_id, m.organization_id, m.role, o.name AS org_name,
       (SELECT count(*) FROM public.organization_members m2
         WHERE m2.organization_id = m.organization_id)          AS miembros,
       (SELECT count(*) FROM public.invoices i
         WHERE i.organization_id = m.organization_id)           AS facturas,
       (SELECT count(*) FROM public.invoices i
         WHERE i.organization_id = m.organization_id
           AND i.state <> 'draft')                              AS facturas_emitidas,
       (SELECT count(*) FROM public.quotes q
         WHERE q.organization_id = m.organization_id)           AS pedidos_albaranes,
       (SELECT count(*) FROM public.documents d
         WHERE d.organization_id = m.organization_id)           AS documentos,
       (SELECT count(*) FROM public.companies c
         WHERE c.organization_id = m.organization_id)           AS clientes,
       (SELECT count(*) FROM public.products p
         WHERE p.organization_id = m.organization_id)           AS productos
FROM u
LEFT JOIN public.organization_members m ON m.user_id = u.id
LEFT JOIN public.organizations o        ON o.id = m.organization_id;
