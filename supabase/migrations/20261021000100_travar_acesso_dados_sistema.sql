-- =============================================================================
-- SISTEM ENVIO VIGI — TRAVAMENTO DO ACESSO DIRETO AO BANCO
-- Projeto Supabase: hnfhrjgzeivzrcpumkyk
-- -----------------------------------------------------------------------------
-- PROBLEMA
--   O `index.html` (publico) embute a chave `anon` do Supabase e usa
--   `supabase.from('compras')`, `supabase.from('shipments')` e
--   `supabase.from('shipment_items')` DIRETAMENTE no navegador.
--   O login do app e cosmetico: a senha e comparada no cliente (PBKDF2) e
--   depois a `anon key` e usada para ler, alterar e EXCLUIR pedidos —
--   sem nenhuma identidade real no banco.
--   Se as politicas RLS dessas tabelas tiverem `USING (true)`, qualquer
--   pessoa que abra o index.html le e apaga dados de pedidos.
--
-- CORRECAO (curto prazo, antes da migracao para o proxy serverless)
--   Negar o acesso direto de `anon`/`authenticated`/`PUBLIC` e deixar o
--   acesso exclusivamente com `service_role` (BYPASSRLS), usado pela
--   Vercel Function.
--
-- ATENCAO / ORDEM DE APLICACAO
--   1) Configurar no Vercel: SUPABASE_SERVICE_ROLE_KEY e o segredo de sessao.
--   2) Publicar o front + as functions (api/*.js).
--   3) Aplicar ESTA migracao (ultimo passo).
--   Ate la, o front com acesso direto ainda funciona; depois, so o proxy.
-- =============================================================================

BEGIN;

-- ── 1. RLS ativo e tambem para o dono da tabela ───────────────────────────
ALTER TABLE public.compras          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shipments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments        FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_items   FORCE  ROW LEVEL SECURITY;

-- ── 2. Remove TODAS as politicas existentes dessas tabelas ─────────────────
-- O DO block e dinamico de proposito: nao depende do nome exato das politicas
-- que existem hoje no banco.
DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['compras', 'shipments', 'shipment_items'] LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- ── 3. Revoga o acesso direto de anon/authenticated/PUBLIC ────────────────
REVOKE ALL ON TABLE public.compras          FROM anon;
REVOKE ALL ON TABLE public.compras          FROM authenticated;
REVOKE ALL ON TABLE public.compras          FROM PUBLIC;

REVOKE ALL ON TABLE public.shipments        FROM anon;
REVOKE ALL ON TABLE public.shipments        FROM authenticated;
REVOKE ALL ON TABLE public.shipments        FROM PUBLIC;

REVOKE ALL ON TABLE public.shipment_items   FROM anon;
REVOKE ALL ON TABLE public.shipment_items   FROM authenticated;
REVOKE ALL ON TABLE public.shipment_items   FROM PUBLIC;

-- ── 4. Mantem o acesso do service_role (usado pelo proxy no Vercel) ────────
-- service_role possui BYPASSRLS e nao e afetado pelo FORCE ROW LEVEL SECURITY.
GRANT ALL ON TABLE public.compras          TO service_role;
GRANT ALL ON TABLE public.shipments        TO service_role;
GRANT ALL ON TABLE public.shipment_items   TO service_role;

-- ── 5. Sequencias (INSERT com id gerado no banco) ──────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['compras', 'shipments', 'shipment_items'] LOOP
    EXECUTE format(
      'DO $$ BEGIN PERFORM setval(%L, COALESCE((SELECT MAX(id) FROM public.%I), 0) + 1, false); EXCEPTION WHEN undefined_table THEN NULL; END $$;',
      pg_get_serial_sequence('public.' || t, 'id'), t);
  END LOOP;
END $$;

COMMIT;

-- =============================================================================
-- VERIFICACAO (rodar depois de aplicar)
-- =============================================================================
--  Espera: o `anon` nao enxerga mais nada nestas tabelas.
--  curl -s "https://hnfhrjgzeivzrcpumkyk.supabase.co/rest/v1/compras?select=id" \
--       -H "apikey: <ANON_KEY>"
--  -> [] (sem grant + sem politica => lista vazia) ou 401/403
--
--  O `service_role` (proxy) continua funcionando:
--  curl -s "https://hnfhrjgzeivzrcpumkyk.supabase.co/rest/v1/compras?select=id" \
--       -H "apikey: <SERVICE_ROLE_KEY>" -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
--  -> 200 com as linhas
