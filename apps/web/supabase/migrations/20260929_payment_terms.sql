-- ============================================================
-- Forma de pago y fecha de pago en facturas emitidas; forma de pago y
-- plazo de vencimiento por cliente/proveedor.
--
-- `documents.payment_method` y `documents.payment_date` ya existían (las
-- facturas recibidas — de compras — las usaban). Las facturas emitidas solo
-- tenían `payment_status` y `due_date`, sin forma de pago ni fecha de cobro.
--
-- Ninguna de estas columnas entra en la protección de inalterabilidad
-- (`protect_issued_invoice` solo congela numeración, fechas de expedición y
-- operación, importes, huellas y NIF), así que se pueden actualizar sobre
-- una factura ya emitida: cobrarla no es alterarla.
--
-- `companies.payment_due_days` es un plazo en días desde la fecha de la
-- factura (30, 60, 90…). Al elegir el cliente en una factura se usa para
-- proponer la fecha de vencimiento, y su `payment_method` para proponer la
-- forma de pago; ambas se pueden cambiar en la propia factura.
--
-- Los códigos de forma de pago son los de `lib/payment-methods.ts` (web y
-- móvil). No se restringen con CHECK porque `documents.payment_method` ya
-- guarda valores sin restricción y conviene que sean la misma lista.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_date   DATE;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS payment_method   TEXT,
  ADD COLUMN IF NOT EXISTS payment_due_days SMALLINT;

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_payment_due_days_check;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_payment_due_days_check
  CHECK (payment_due_days IS NULL OR payment_due_days BETWEEN 0 AND 365);
