-- ============================================================
-- Selector de moneda en presupuestos, albaranes y facturas
--
-- `quotes.currency` e `invoices.currency` ya existían (DEFAULT 'EUR', texto
-- libre, sin selector en la interfaz — todo se emitía en euros en la
-- práctica). Esto añade el tipo de cambio manual que exige el Reglamento de
-- Facturación (RD 1619/2012, art. 6.1.j) para expresar una factura en una
-- moneda distinta del euro, y restringe `currency` a las monedas que la
-- interfaz ofrece.
--
-- El esquema de VeriFactu (SuministroInformacion.xsd) no tiene campo de
-- moneda: los importes que se registran, se encadenan en la huella y se
-- remiten a la AEAT son siempre en euros. Por eso `exchange_rate` no es
-- decorativo — es lo que permite convertir a euros lo que ve y cobra el
-- cliente antes de construir el registro de alta. Se guarda como "euros por
-- 1 unidad de la moneda extranjera" (p. ej. 1 USD = 0,93 => exchange_rate =
-- 0.93), así que importe_eur = importe_moneda * exchange_rate.
--
-- Apply via: Supabase Dashboard → SQL Editor → Run
-- ============================================================

ALTER TABLE public.quotes    ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(12,6);
ALTER TABLE public.invoices  ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(12,6);

ALTER TABLE public.quotes   DROP CONSTRAINT IF EXISTS quotes_currency_check;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_currency_check;
ALTER TABLE public.quotes   DROP CONSTRAINT IF EXISTS quotes_exchange_rate_check;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_exchange_rate_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_currency_check CHECK (currency IN ('EUR', 'USD', 'GBP'));
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_currency_check CHECK (currency IN ('EUR', 'USD', 'GBP'));

-- EUR no lleva tipo de cambio (no hay nada que convertir); cualquier otra
-- moneda lo exige, y tiene que ser positivo.
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_exchange_rate_check CHECK (
    (currency = 'EUR' AND exchange_rate IS NULL) OR
    (currency <> 'EUR' AND exchange_rate IS NOT NULL AND exchange_rate > 0)
  );
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_exchange_rate_check CHECK (
    (currency = 'EUR' AND exchange_rate IS NULL) OR
    (currency <> 'EUR' AND exchange_rate IS NOT NULL AND exchange_rate > 0)
  );
