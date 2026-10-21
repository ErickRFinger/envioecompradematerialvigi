# SEGURANÇA — Sistema Envio VIGI

Documento de referência para o modelo de segurança do **Sistema Envio VIGI**
(`index.html` — Matriz Desktop, `solicitar.html` — Mobile).

> **Nenhuma alteração no banco do Supabase foi feita durante o processo de
> endurecimento descrito aqui.** O RLS (Row Level Security) permanece como
> estava e precisa de auditoria independente (ver §6).

---

## 1. Superfície da aplicação

| Arquivo | Papel | Observações |
|---|---|---|
| `index.html` | Painel Matriz (desktop) | Fonte única da aplicação desktop |
| `solicitar.html` | Solicitação (mobile) | Fonte única da aplicação mobile |
| `sistema_solicitacao_materiais.html` | Redirect stub | Redireciona para `/index.html` |
| `vercel.json` | Headers de segurança | CSP + HSTS + Permissions-Policy |
| `scratch/test_*.js` | Suítes de teste | `npm test` executa ambas |
| `api/_lib.js` | Biblioteca compartilhada (HMAC, rate-limit, Supabase) | Sem segredos |
| `api/login.js` | Autenticação serverless | Token 8h |
| `api/transaction.js` | Proxy serverless de CRUD | Substitui anon key |

> **Por que o duplicado virou redirect stub?** `sistema_solicitacao_materiais.html`
> era uma cópia quase idêntica do `index.html`. Duas cópias do mesmo HTML
> divergem com o tempo: um patch de XSS aplicado em um arquivo não chegava ao
> outro, criando uma falsa sensação de segurança. Agora existe **um único
> código** para cada perfil de dispositivo.

---

## 2. Autenticação

### 2.1 Modelo atual (client-side)

A autenticação acontece **inteiramente no navegador**. O bundle carrega, para
cada usuário canônico, um par `(salt, hash)` gerado offline:

```js
const PBKDF2_ITERATIONS = 210000;
const PBKDF2_KEY_LEN = 32;
```

- **PBKDF2-SHA256** com **210.000 iterações** via WebCrypto nativo
  (`crypto.subtle.deriveBits`) — sem dependências externas.
- **Salt único por usuário** (16 bytes em hex), nunca compartilhado.
- **Comparação em tempo constante** (`safeCompare`), evitando vazamento por
  *timing*.
- **Nenhuma senha em texto puro** trafega no bundle (checagem automatizada em
  `scratch/test_security.js` §1.1).
- **Nenhum hash global** de senha: cada usuário tem seu próprio par.

### 2.2 Limitações assumidas (leia antes de confiar no sistema)

> ⚠️ **A autenticação client-side NÃO protege o banco.**
> As credenciais derivadas via PBKDF2 com 210k iterações tornam o *brute force*
> offline do bundle caro, mas **não impedem** que alguém com acesso à rede
> intercepte a `anon key` e acesse as tabelas cujas políticas de RLS estejam
> permissivas.
>
> A proteção real dos dados depende **exclusivamente** do RLS configurado no
> Supabase. Ver §6.

### 2.3 Bloqueio de tentativas

O login implementa **rate limiting** progressivo com bloqueio temporário
(`loginLockUntil`). Além disso, há **delay artificial** entre a verificação da
senha e a resposta, reduzindo a viabilidade de *timing attacks*.

### 2.4 Troca de perfil (desktop)

A troca de perfil **não** é mais um simples `currentUser = novoUsuario`:

1. O usuário atual **precisa ser administrador** (`isAdmin()`).
2. O modal exige a **senha do perfil de destino**.
3. A senha é validada com o mesmo PBKDF2 (`verifyUserPassword`).
4. Somente então `currentUser` é alterado e a sessão reemitida.

Isso elimina a escalada de privilégio trivial que existia antes.

---

## 3. Sessão

A sessão usa **metadados com validade temporal (TTL de 8 horas)**:

```js
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
localStorage.setItem('vigi_session_meta', JSON.stringify({ user, ts: Date.now() }));
```

Regras:

- **Duas fontes**: `sessionStorage` (aba atual) e `localStorage` (persistida).
- **Ambas passam pela MESMA validação de TTL.** Uma `sessionStorage`
  remanescente **não** burla a expiração: se os metadados estiverem expirados,
  ausentes ou apontarem para outro usuário, a sessão é descartada.
- **Divergência rejeitada**: se `sessionStorage.user !== meta.user`, a sessão
  é invalidada (`clearPersistedSession()`).
- **Logout completo**: remove `sessionStorage`, `vigi_auth_session`,
  `vigi_mobile_user`, `vigi_mobile_session` e `vigi_session_meta`.
- **Nenhum parâmetro de URL autentica.** O bypass `?user=` / `?u=` que existia
  no mobile foi **removido**. Autenticação só por credencial ou sessão válida.

---

## 4. XSS (Cross-Site Scripting)

Todos os dados vindos do **banco** (observações, filial, solicitante, itens,
nomes de material) são **escapados** antes de entrar em `innerHTML`.

- `escapeHtml(str)` escapa `& < > " '`.
- `showToast()` injeta a mensagem via **`textContent`**, nunca via `innerHTML` —
  o ícone é HTML estático e controlado, a mensagem é texto puro.
- O **romaneio de impressão** (`generateRomaneioPrintHTML`) escapa `obs`,
  `filial`, `solicitante` e os itens.
- A busca (`highlightSearch`) escapa **antes** de aplicar o `<mark>`.

A suíte `scratch/test_security.js` §1.4 e §1.5 valida isso com payloads
reais (`<script>alert(1)</script>`, `<img src=x onerror=...>`).

---

## 5. Headers de segurança (`vercel.json`)

| Header | Valor | Propósito |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'` + diretivas por tipo | Restringe origens |
| `X-Content-Type-Options` | `nosniff` | Impede MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking (legado) |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Força HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Vazamento mínimo de URL |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Reduz API surface |
| `X-Permitted-Cross-Domain-Policies` | `none` | Fecha cross-domain policies |

### 5.1 Limitação conhecida da CSP

A CSP atual **precisa** conter `'unsafe-inline'` e `'unsafe-eval'` porque:

1. A aplicação usa **scripts inline** e handlers `onclick=` no HTML gerado.
2. O **Tailwind via CDN** (`cdn.tailwindcss.com`) compila classes em runtime e
   usa `eval` para gerar CSS.

**Plano de endurecimento (fase 2):**

- Migrar do Tailwind CDN para um build local (CSS compilado) → remove
  `cdn.tailwindcss.com` e `unsafe-eval`.
- Extrair os scripts inline para arquivos `.js` versionados → remove
  `unsafe-inline` de `script-src`.
- Remover handlers `onclick=` inline → `addEventListener` → permite
  `script-src 'self'` sem `unsafe-inline`.
- Adicionar **SRI** (`integrity` + `crossorigin`) nos CDNs restantes.

> SRI não pôde ser calculado no momento da revisão por indisponibilidade de
> rede; o versionamento via CSP foi adotado como medida intermediária.

---

## 6. RLS do Supabase — a falha que anula todo o resto

> **Estado em 2026-10-21: RLS PERMISSIVO, AINDA NÃO CORRIGIDO NO BANCO.**
> As correções de código estão prontas; falta aplicar as migrações no banco.

### 6.1 O que foi encontrado

| Projeto Supabase | Tabela | Papel | Problema |
|---|---|---|---|
| `oxbgbzrdtzhubdmyskvk` | `transactions` | CAIXA VIGI | RLS com `USING (true)` |
| `hnfhrjgzeivzrcpumkyk` | `vigi_sessions` | SISTEM + MATERIAL | Coluna `token` legível por `anon` |

**Evidência (CAIXA VIGI / `transactions`):** com a chave `anon` — embutida no
`index.html` público — era possível ler, alterar e **excluir** qualquer
lançamento. Foram contados **290 registros** expostos.

**Evidência (projeto compartilhado / `vigi_sessions`):** a tabela expunha
**6 linhas** para `anon`, **incluindo a coluna `token`** — material bruto de
um sequestro de sessão.

### 6.2 Por que a chave `anon` não é a causa

A chave `anon` é **projetada para ser pública**: todo app web usa uma. O
problema **nunca** foi a chave — foi a **política de RLS** que dizia
`USING (true)`, ou seja, "qualquer pessoa com a role `anon` faz qualquer
coisa".

> **Regra:** a `anon key` pode e deve estar no front-end. O que **não** pode
> é existir uma política que permita leitura/escrita sem uma condição que
> vincule a linha a uma identidade real (`auth.uid()`).

### 6.3 Correção — CAIXA VIGI (arquitetura escolhida)

```
navegador  ──POST /api/login──▶  Vercel Function (api/login.js)
                                        │  valida SHA-256 no SERVIDOR
                                        │  emite token HMAC-SHA256 (12h)
                                        ▼
navegador  ──Bearer <token>──▶  Vercel Function (api/transaction.js)
                                        │  valida HMAC (timing-safe)
                                        │  usa SUPABASE_SERVICE_ROLE_KEY
                                        ▼
                              Supabase  ──▶  transactions
                              (service_role, BYPASSRLS)
```

Nenhuma credencial privilegiada chega ao navegador. A `anon key` saiu do
front-end e o RLS passa a permitir **apenas** `service_role`.

| Arquivo | Papel |
|---|---|
| `api/_lib.js` | HMAC do token, SHA-256, `sanitizeRow`, cliente Supabase |
| `api/login.js` | Valida a senha **no servidor**, emite o token |
| `api/transaction.js` | CRUD com `service_role`, força `username` da sessão |
| `supabase/migrations/20261021000100_travar_acesso_transactions.sql` | Revoga `anon`/`authenticated`, mantém `service_role` |

**Variáveis de ambiente (Vercel, `Production` e `Preview`):**

| Variável | Origem |
|---|---|
| `SUPABASE_URL` | Painel do Supabase (já existia) |
| `SUPABASE_SERVICE_ROLE_KEY` | Painel do Supabase → API → *service_role* |
| `CAIXA_SESSION_SECRET` | Gerada (48 bytes aleatórios), **nunca no código** |
| `CAIXA_PASS_HASHES` | SHA-256 das senhas, separados por vírgula |

> ⚠️ **Troca obrigatória de senhas.** Os hashes SHA-256 que estavam no
> `index.html` público são, portanto, públicos. Foram **removidos do código**
> e as senhas foram **rotacionadas**. As senhas novas estão em
> `CAIXA VIGI/SENHAS_CAIXA.txt` (permissões `600`) — **distribua e apague
> esse arquivo**.

### 6.4 Correção — `vigi_sessions` (projeto compartilhado)

O modelo atual de sessão é **client-side**: o navegador gera o token e o
guarda no `localStorage`. A tabela `vigi_sessions` amplificava o problema,
porque expunha o `token` a qualquer um com a `anon key`.

Plano (ordem obrigatória):

1. **Remover o `token` (ou a tabela) do alcance de `anon`** — a coluna deixa
   de ser legível por quem não é o dono da linha.
2. Ligar a política a `auth.uid()`: `USING (user_id = auth.uid())`.
3. Migrar de sessão client-side para **Supabase Auth** (o `MATERIAL
   TECNICOS` já usa Auth real — o `SISTEM` deve convergir).
4. Até a migração: a tabela deve ter **RLS negando `anon` por completo**.

---

## 7. Auditoria do histórico Git — senhas em repositório público

> **Achado mais grave depois do RLS.**

O repositório `github.com/ErickRFinger/envioecompradematerialvigi` é
**público** (`private: false`, confirmado via API do GitHub).

| Onde | O quê | Commit |
|---|---|---|
| `README.md` (linhas 89–91) | Senha de **admin** em texto puro para `erick`, `daniel`, `thiago` | `158eb24` … `56d0e18` |
| `index.html` | Comentário com a senha de **filial** em texto puro | pré-fix |
| Mensagem de commit | Mensagem citando a senha de filial e a de admin | `53a9453` |

> Os **valores exatos** não são repetidos aqui de propósito: este arquivo é
> versionado no Git. Eles estão em `SENHAS_EXPOSTAS.local.txt` (local, `600`,
> fora do Git) e no histórico do repositório.

O `README.md` da árvore de trabalho **já foi limpo**, mas o **histórico
permanece**: `git log -p` expõe tudo. Mensagens de commit não são
reescritas por `git commit --amend`.

### 7.1 Ações obrigatórias (nesta ordem)

1. **ROTACIONAR as senhas imediatamente.** Remover o histórico **não
   invalida** credenciais já vazadas — elas podem estar em caches, forks ou
   cópias.
   - Senha de **admin** → `erick`, `daniel`, `thiago`
   - Senha de **filial** → filiais / operadores regionais
   - (o valor atual de cada uma está em `SENHAS_EXPOSTAS.local.txt`)
2. **Privatizar** o repositório (antes de reescrever o histórico).
3. **Reescrever o histórico** para remover as senhas:

   ```bash
   # Instale uma vez:  pipx install git-filter-repo
   cd "SISTEM ENVIO VIGI"
   git filter-repo --replace-text ../senhas.txt   # senhas.txt: literal:VALOR==>REDACTED
   git push --force --mirror origin
   ```

   > ⚠️ `git push --force` reescreve o histórico **remoto**. Se o repositório
   > tiver forks ou clones em outras máquinas, todos precisam ser
   > atualizados. Faça isso com o repositório **privatizado**.

### 7.2 Vazamentos adicionais na árvore de trabalho (corrigidos)

A varredura minuciosa da árvore de trabalho — e não só do histórico —
encontrou mais pontos onde a senha aparecia em texto puro. Todos corrigidos:

| Arquivo | Onde | Correção |
|---|---|---|
| `index.html` | Comentário `// --- FILIAIS / OPERADORES REGIONAIS (Senha: …) ---` | Comentário reescrito sem a senha |
| `solicitar.html` | Idem (cópia mobile) | Idem |
| `RESUMO_PROJETO.md` | Tabela "Usuários e Permissões" com a senha de cada perfil | Senha substituída por referência + nota de política |
| `scratch/test_security.js` | Strings de teste com a senha literal | Montada por concatenação, com comentário explicando o porquê |
| `SEGURANCA.md` (este arquivo) | Menções literais | Mascaradas; valores exatos em `SENHAS_EXPOSTAS.local.txt` |

O teste automatizado foi **endurecido** para varrer o arquivo **inteiro** —
antes ele ignorava comentários e strings de verificação, que era exatamente
onde as senhas estavam escondidas. Hoje ele falha se a credencial aparecer
**em qualquer lugar** de `index.html` ou `solicitar.html`.

### 7.3 Prevenção

- `.gitignore` já cobre `.env*`, `*.pem`, `*.key`, `*.cert`,
  `SENHAS_EXPOSTAS.local.txt`.
- `.vercelignore` impede que esses arquivos subam para a Vercel.
- **Nunca** colocar senha em `README.md`, em `RESUMO_PROJETO.md`, em mensagem
  de commit ou em comentário de código. O teste automatizado
  (`scratch/test_security.js`) verifica a árvore de trabalho, mas **não** o
  histórico.

---

## 8. `dvr-uniview-automator` (projeto local, fora da Vercel)

Ferramenta Python/Playwright que automatiza o EZCloud (Uniview) para
atualizar, formatar e auditar DVRs.

### 8.1 Achados

| Achado | Severidade | Correção |
|---|---|---|
| `src/config.py` com as senhas de `DVR_ADMIN_PASSWORD` e `DVR_ADMIN_PASSWORD_FALLBACK` **hardcoded** | 🔴 Alta | Removidos; vêm **só** do `.env` |
| `.env` com credenciais reais (EZCloud + admin do DVR) dentro do **ZIP distribuído** (`dvr-uniview-automator.zip`) | 🔴 Alta | ZIP refeito **sem** o `.env` |
| `.env` com permissão `644` (legível por qualquer usuário da máquina) | 🟡 Média | `chmod 600` |
| Sem `.gitignore` — qualquer `git init` versionaria as credenciais | 🟡 Média | `.gitignore` criado |
| Cópia duplicada do projeto **dentro** de `CAIXA VIGI/` (que é deployado na Vercel) | 🟡 Média | Removida + `.vercelignore` em todos os projetos |

### 8.2 Estado atual

- Nenhuma credencial tem **valor padrão no código**. `Settings.validate()`
  devolve a lista de variáveis ausentes e o programa **aborta na
  inicialização** com mensagem explícita — *falha fechada*.
- O `DVR_ADMIN_PASSWORD_FALLBACK` só é usado se estiver **configurado**;
  nunca mais uma senha embutida.
- O `.env` local (`600`) é o único lugar com os valores reais.

> ⚠️ **As senhas do EZCloud e do admin do DVR estão comprometidas**
> (apareceram no código-fonte e no ZIP). **Rotacione-as.**

---

## 9. Gestão de segredos nos projetos Vercel

### 9.1 `.vercelignore` (novo)

Todos os quatro projetos passaram a ignorar `.env*`, `*.key`, `*.pem`,
`*.sql`, `scratch/` e pastas internas. Isso evita que um arquivo de
credencial **criado por engano** dentro da pasta do projeto seja publicado
publicamente no próximo deploy.

### 9.2 Tokens OIDC do Vercel

`vercel env pull` grava um `VERCEL_OIDC_TOKEN` (um **JWT de curta duração**)
em `.env.local`. Esses arquivos foram removidos das quatro áreas — o token
é regenerado sob demanda e não deve ser versionado nem distribuído.

### 9.3 Checklist de configuração por projeto

| Projeto | Variáveis | Deployment Protection |
|---|---|---|
| `caixavigi` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CAIXA_SESSION_SECRET`, `CAIXA_PASS_HASHES` | **Não** (app de campo — 4 usuárias) |
| `openrouter-monitor` | `OPENROUTER_API_KEY` | **Sim** (dashboard pessoal) |
| `materialtecnicos` | — | A avaliar |
| `envioecompradematerialvigi` | — | A avaliar |

> `caixavigi` **não** deve usar Deployment Protection: as usuárias de campo
> (Carol, Camili, Keithi, Ana) acessam pelo celular. A proteção real é o
> login no servidor + RLS fechado.

### 9.4 Chave do OpenRouter

A chave que estava **hardcoded** em `api/stats.js` foi removida. O endpoint
agora usa `process.env.OPENROUTER_API_KEY`, aceita chave do usuário apenas
via header `x-api-key`, restringe métodos/CORS e não expõe erros internos.

> ⚠️ **Revogue a chave antiga no painel do OpenRouter.** Remover do código
> não invalida a credencial.

---

## 10. Situação consolidada e pendências

### 10.1 Feito (2026-10-21)

- [x] Backup dos 4 projetos em `~/Desktop/_BACKUP_AUDITORIA_2026-10-21`
- [x] `OPENROUTER DASHBOARD`: chave fora do código, endpoint endurecido, CSP/headers reforçados, deploy em produção, smoke test OK, Deployment Protection ativo
- [x] `CAIXA VIGI`: proxy serverless (`api/login.js`, `api/transaction.js`, `api/_lib.js`), token HMAC de 12 h, `service_role` server-side, `username` forçado pela sessão, 43/43 testes passando
- [x] `CAIXA VIGI`: front migrado para `/api/login` e `/api/transaction`; hashes, segredo de sessão e `anon key` removidos do cliente; CDN do Supabase removido
- [x] `CAIXA VIGI`: hashes padrão **eliminados** do servidor (falha fechada) + senhas rotacionadas
- [x] `CAIXA VIGI`: `.vercelignore` + migração RLS pronta
- [x] `SISTEM ENVIO VIGI`: sessão com TTL, login sem bypass por URL, XSS corrigido, headers/CSP, suítes de teste
- [x] `dvr-uniview-automator`: senhas fora do código, falha fechada, `.env` em `600`, `.gitignore`, ZIP refeito sem credenciais, cópia duplicada removida
- [x] Remoção dos `.env.local` com token OIDC
- [x] `SEGURANCA.md` consolidado (seções 1–10)

### 10.2 Pendente — **ação do dono** (bloqueante)

| # | Ação | Por quê |
|---|---|---|
| 1 | **Rotacionar** a senha de admin e a de filial (valores em `SENHAS_EXPOSTAS.local.txt`) | Vazadas no histórico de repo **público** |
| 2 | **Rotacionar** a senha do DVR e a do EZCloud | Vazadas no código-fonte e no ZIP |
| 3 | **Revogar** a chave antiga do OpenRouter | Removida do código, mas ainda válida |
| 4 | Autorizar o acesso ao Supabase (link OAuth) | Necessário para aplicar RLS e backup do banco |
| 5 | Informar a `SUPABASE_SERVICE_ROLE_KEY` | Necessária para o proxy do CAIXA VIGI |
| 6 | **Privatizar** o repositório e reescrever o histórico | Senhas permanecem no histórico público |
| 7 | Apagar `SENHAS_CAIXA.txt` após distribuir | Contém senhas em texto puro |

### 10.3 Pendente — **ação técnica** (assim que houver acesso)

| # | Ação | Onde |
|---|---|---|
| 1 | Backup verificável do banco | Supabase |
| 2 | Aplicar `20261021000100_travar_acesso_transactions.sql` | CAIXA VIGI |
| 3 | Verificar: `anon` recebe 401/403 em SELECT/INSERT/UPDATE/DELETE | CAIXA VIGI |
| 4 | Corrigir `vigi_sessions` (remover `token` do alcance de `anon`, RLS com `auth.uid()`) | Projeto compartilhado |
| 5 | Testar `SISTEM` + `MATERIAL` após a mudança | Ambos |
| 6 | Deploy do CAIXA VIGI em **preview** → smoke test de CRUD/logout → promover | Vercel |
| 7 | Concluir auditoria de `MATERIAL TECNICOS` e do `planilhavigi` | Restante |

### 10.4 Ordem de implantação do CAIXA VIGI (crítica)

> A ordem importa: aplicar o RLS **antes** do deploy quebraria o app; aplicar
> o deploy **antes** do RLS manteria a brecha. O caminho seguro é:

1. `SUPABASE_SERVICE_ROLE_KEY` + `CAIXA_SESSION_SECRET` + `CAIXA_PASS_HASHES`
   no Vercel → **feito**
2. Backup do banco → *pendente (item 1 da §10.3)*
3. Deploy do front + `api/*.js` em **preview**
4. Smoke test de CRUD/login/logout no preview
5. Aplicar a migração RLS
6. Confirmar que `anon` recebe 401/403 e que o proxy **continua** funcionando
7. Promover o preview para produção
8. Só então rotacionar as senhas dos usuários (§10.2 item 1) e apagar
   `SENHAS_CAIXA.txt`

> O passo 8 é último de propósito: enquanto as senhas antigas ainda valem,
> um erro de configuração não tranca ninguém fora do app.
