# Contexto — Migração Proxy Serverless SISTEM ENVIO VIGI

## Status geral
**4 suítes de teste passando com 100% verde** (`npm test`):
- test_tool_justifications.js ✅
- test_security.js ✅  
- test_order_details_modal.js ✅
- test_api_proxy.js ✅

## Arquivos criados/modificados

### Criados
| Arquivo | Função | Status |
|---------|--------|--------|
| `api/transaction.js` | Proxy serverless CRUD (compras, shipments, shipment_items) | ✅ Criado e testado |
| `scratch/test_api_proxy.js` | Testes do proxy (14 testes) | ✅ Criado e aprovado |

### Modificados
| Arquivo | Alteração | Status |
|---------|-----------|--------|
| `api/_lib.js` | Adicionado `clientIp`, `registerAttempt`, `clearAttempts`, `RATE_LIMIT`, `TABLES`, `TABLE_LIST` | ✅ Concluído |
| `index.html` | Substituído `var supabase = ...` (anon key) por `db` shim + `apiFetch` + `apiToken` + `login()` | ✅ Parcial (~70%) |
| `SEGURANCA.md` | Documentação atualizada com seção sobre proxy serverless | ✅ Concluído |

## Estado do index.html

### ✅ Feito (linhas ~1626-1690)
- Removido `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `var supabase = createClient(...)`
- Adicionado `apiToken`, `apiFetch()`, `login()`, `db` shim com API builder (`.from().select().order().limit().eq().insert().update().delete().then()`)
- `db` roteia todas as operações via `/api/transaction` com `Bearer apiToken`
- Variáveis `supabasePayloads` (apenas variável local, não cliente) mantidas

### ⏳ Pendente no index.html (substituir `supabase` por `db`)
Linha | Código | Problema
------|--------|---------
4048 | `await supabase\n          .from('shipments')` | `db.from('shipments')`
4074 | `await db.from('compras').update(...)` ✅ já corrigido
4099 | `await supabase.from('compras').delete().eq('id', rawId)` | ⏳
4124-4125 | `await supabase.from('shipment_items/shipments')...` | ⏳
4524-4551 | `await supabase\n          .from('shipments')...` + `await supabase.from('shipment_items').insert(...)` | `db.from(...)`
4551 | `await db.from('shipment_items').insert(itemsPayload)` ✅ já corrigido
5574-5586 | `await supabase.from('shipment_items/shipments')...` | ⏳
6265-6267 | `initRealtime()` com `supabase.channel(...)` | ⏳ Substituir por polling (já existe setInterval 15s)

### ✅ Já corrigidos no index.html
- Linha 2831: `if (!supabase)` → `if (!db)`
- Linha 2835: `let query = supabase` → `let query = db`
- Linha 2997: `if (!supabase)` → `if (!db)`
- Linha 4045: `if (pedido.rawId && supabase)` → `if (pedido.rawId && db)`
- Linha 4048: `await supabase` → `await db`
- Linha 4072-4074: `if (supabase && compra.rawId)` → `if (db && compra.rawId)` + `db.from(...)`
- Linha 4524: `const { data, error } = await supabase` → `await db`

## Estado do solicitar.html

### ⏳ Ainda não iniciado
Todas as referências abaixo ainda usam `supabase` direto com **anon key exposta**:
- Linha 1169-1173: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `var supabase = createClient(...)`
- Linha 3087, 3115: `await supabase\n          .from(...)`
- Linha 3371: `let query = supabase\n          .from(...)`
- Linha 4041: `const { error } = await supabase.from('compras').update(...)`
- Linha 4611-4612: `await supabase.from('shipment_items/shipments').delete(...)`
- Linha 4640-4642: `if (!supabase) return;` + `const { data, error } = await supabase`
- Linha 5285-5287: `if (!supabase || !rawId)` + `supabase.from('compras').update(...)`
- Linha 5301-5302: `if (supabase && rawId)` + `supabase.from('compras').delete(...)`
- Linha 5315-5317: `if (!supabase) return;` + `supabase.channel(...)` (realtime)
- Linha 29: `<script src="@supabase/supabase-js@2">`

## Backup dos arquivos originais
- `/tmp/index.html.backup` (324KB) — estado antes das edições
- `/tmp/solicitar.html.backup` (262KB) — estado original

## Próximos passos (amanhã)
1. Corrigir os `supabase` restantes no `index.html` (linhas listadas acima)
2. Migrar `solicitar.html`: remover anon key, adicionar `db` shim + `apiFetch`, substituir todas as chamadas `supabase.from()` por `db.from()`
3. Aplicar migração SQL de RLS no Supabase (`supabase/migrations/20261021000100_travar_acesso_dados_sistema.sql`)
4. Configurar env vars no Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SISTEM_SESSION_SECRET`, `SISTEM_USERS`, `SISTEM_USER_CREDS`
5. Rodar `npm test` para validar tudo com 100%

## Como o proxy funciona
- Frontend chama `/api/transaction` com `Authorization: Bearer <token>`
- Token é obtido via `POST /api/login` com `{username, password}`
- Servidor usa `SUPABASE_SERVICE_ROLE_KEY` (BYPASSRLS) para falar com o Supabase
- Cliente NUNCA tem acesso direto ao banco
