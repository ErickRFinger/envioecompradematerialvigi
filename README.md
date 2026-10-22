# 📦 SISTEM ENVIO VIGI - Sistema de Gestão de Envios e Materiais

> **Resumo Executivo e Guia Técnico de Continuidade do Projeto**  
> Desenvolvido para centralizar, rastrear e organizar as solicitações de materiais entre a **Matriz** e as filiais de **Francisco Beltrão**, **Palotina** e **Barracão** (Paraná).

---

## 📌 1. Visão Geral do Projeto & Contexto de Negócio

### ⚠️ O Problema Anterior:
Antes, cada filial enviava listas de pedidos soltas em grupos individuais de WhatsApp. Isso gerava:
- **Mensagens perdidas** e falta de rastreabilidade (ninguém sabia o que já tinha sido separado ou despachado).
- **Sobrecarga do Almoxarifado** da Matriz por falta de padronização.
- **Risco de filiais desabastecidas** com técnicos parados em obras.
- **Setor de Compras sem visibilidade** das necessidades reais de reposição de estoque central.

### ✅ A Solução Implementada:
Uma aplicação web moderna, responsiva em **Dark Glassmorphism UI**, dividida em **dois fluxos integrados (Kanban / Trello style)**:
1. **Envio de Material para Filiais:** Solicitação das filiais ➔ Separação ➔ Coleta ➔ Transporte ➔ Entrega.
2. **Compras & Reposição de Estoque Central:** Almoxarife/Estoque identifica itens em falta ➔ Solicitação de Compra ➔ Comprado a caminho ➔ Em estoque.

---

## 🔄 2. Fluxos e Pipelines Operacionais

```mermaid
graph TD
    subgraph FLUXO 1: ENVIOS PARA FILIAIS
        A1["1. Aguardando Separação"] --> A2["2. Em Separação"]
        A2 --> A3["3. Pronto p/ Coleta"]
        A3 --> A4["4. Em Rota / Trânsito"]
        A4 --> A5["5. Entregue / Concluído"]
    end

    subgraph FLUXO 2: COMPRAS & ESTOQUE MATRIZ
        B1["1. Solicitação de Compra"] --> B2["2. Comprado (Aguardando Chegada)"]
        B2 --> B3["3. Em Estoque / Recebido"]
    end
```

---

## 🚀 3. Funcionalidades Prontas no Frontend

1. **Dois Painéis Kanban em Abas:**
   - **Aba 1 (Envios):** 5 colunas com arraste e solte (**Drag and Drop** nativo em HTML5), setas de avanço rápido e barra de progresso visual (20% a 100%) por card.
   - **Aba 2 (Compras):** 3 colunas gerenciando o ciclo de suprimentos com fornecedores.
2. **Catálogo Completo com 10 Categorias e ~90 Materiais Reais:**
   - Marketing e Outros (Adesivos, Camisas, Placas)
   - **Equipamentos Técnicos (Ferramentas)**: Aba separada no catálogo com **justificativa obrigatória por material** (motivo de reposição como "estragou, tentamos arrumar mas não deu certo").
     - **Permitidos para visualizar e pedir ferramentas**: SOMENTE **Iury** (`beltrao1`/`iury`), **Giseli** (`barracao1`/`giseli`), **Adilson** (`palotina1`/`adilson`) e **Administradores**.
     - **Bloqueados para ferramentas**: **Cleverson** (`beltrao2`/`cleverson`), **Leonardo** (`pato1`/`leonardo`) e **Técnicos de SMO** (`smo1`/`smo`/`terceiros`). A aba é completamente ocultada do catálogo deles e bloqueada contra pedidos.
   - Cabos e Fios (Bobinas de Fibra [restrita], Lubrificante Passa Fio [restrito], Cabos de Rede, Energia...)
   - Elétrica e Proteção (Fontes 12V, Nobreaks, Baterias...)
   - Infraestrutura e Fixação (Canaletas, Parafusos, Caixas de Passagem, Eletroduto em barras de 3m...)
   - Câmeras (Modelos homologados UNV Bullet/Dome, ColorVu, Dual Light, Hik Sirene, IP Bullet/Dome, EZVIZ, Varifocal)
   - Informática e Diversos (HDs 1TB/2TB, SSDs, Switches, Kits de Fibra [restrito]...)
   - Alarmes e Sensores (Centrais, Sensores com/sem fio, Sirenes...)
   - Conectores e Vídeo (BNC, tomada macho, P4, RJ45, Wago para emenda de energia, Balun, POE, Media Converter)
   - Gravadores DVR (Hikvision, Intelbras, UNV 4/8/16 canais)
   > *Nota de Controle:* Materiais sem estoque para filiais (itens de fibra óptica e `Lubrificante Passa Fio`) são exclusivos para Admins (ocultos no catálogo de filiais). Ferramentas são liberadas exclusivamente para Iury, Giseli e Adilson em aba separada com exigência de justificativa individual. Suprimentos regulares seguem liberados para todos os técnicos.
3. **Modal de Solicitação Inteligente:**
   - Seleção de Filial com botão dedicado (`Francisco Beltrão`, `Palotina`, `Barracão`, `Pato Branco`, `Terceiros SMO`).
   - Carrossel com chips de filtros por categoria com destaque visual para ferramentas (`Exige Motivo`).
   - Formulário inline / modal para digitação de justificativa de cada ferramenta selecionada (mínimo de 5 caracteres).
   - Stepper de quantidades (`-` / `+`) com iluminação do card e carrinho em tempo real.
   - Persistência durável do carrinho e justificativas no `localStorage` para evitar perda de dados quando o celular minimizar.
4. **Disparo Formatado para WhatsApp em 1 Clique:**
   - Botão **"Zap"** que gera mensagem formatada em Markdown com emojis e copia para a área de transferência para colar no grupo da filial.
5. **Romaneio / Checklist de Separação para Impressão:**
   - Folha de conferência formatada para impressora com caixas de marcação `[✓]` para o almoxarife conferir nas prateleiras e campos de assinatura física.
6. **Filtros Globais em Tempo Real:**
   - Filtro rápido por filiais e campo de busca instantâneo por código, solicitante ou material.
7. **Sistema de Notificações Toast:**
   - Notificações visuais flutuantes para todas as ações.
8. **Persistência Local (`localStorage`):**
   - Os dados e status dos cards persistem no navegador mesmo se recarregar a página (`F5`).

---

## 📂 4. Arquivos do Projeto & Arquitetura

| Arquivo | Descrição |
| :--- | :--- |
| `index.html` | Dashboard principal Matriz (Kanban & Tabela) conectado ao Supabase em tempo real com autenticação PBKDF2. |
| `solicitar.html` | **Aplicativo Web Mobile (PWA)** para técnicos solicitarem materiais pelo celular com rastreio ao vivo. |
| `sistema_solicitacao_materiais.html` | *Redirect stub* canônico apontando para `index.html` (fonte única de verdade, eliminando divergências). |
| `api/transaction.js` | Proxy serverless CRUD completo (listCompras, listShipments, create/update/deleteShipment). |
| `api/login.js` | Endpoint serverless de login e emissão de tokens HMAC seguros (8h de validade). |
| `api/_lib.js` | Biblioteca do servidor com validação criptográfica, rate limiting por IP e conexão Supabase. |
| `SEGURANCA.md` | Documentação oficial e completa do modelo de segurança e auditoria. |
| `vercel.json` | Configurações de deploy com headers de segurança rígidos (CSP, HSTS, frame-ancestors). |
| `scratch/test_security.js` | Suíte de testes automatizados de segurança (10 verificações de ponta a ponta). |
| `scratch/test_tool_justifications.js` | Suíte de testes automatizados de matriz de permissões e justificativas de ferramentas. |
| `scratch/test_order_details_modal.js` | Suíte de testes automatizados para estabilidade e abertura dos modais de pedidos. |
| `scratch/test_api_proxy.js` | Suíte de testes automatizados de integração do proxy serverless (`/api/login` e `/api/transaction`). |
| `RESUMO_PROJETO.md` | Documento de arquitetura e especificações. |
| `README.md` | Esta documentação oficial. |

### 🛡️ 4.1. Camada de Segurança e Hardening (Implementado)
O sistema passou por uma auditoria completa de segurança:
1. **Derivação Criptográfica PBKDF2-SHA256 (210.000 iterações):** Credenciais não trafegam em texto plano. Cada usuário tem `salt` individual e verificação nativa via `crypto.subtle`.
2. **Comparação em Tempo Constante (`safeCompare`):** Imunidade a ataques de temporização (*Timing Attacks*).
3. **Mitigação Rigorosa de XSS:** Toda injeção dinâmica usa `textContent` puro (`document.createElement`), neutralizando ataques via banco de dados ou formulários.
4. **Content-Security-Policy (CSP):** Configurado no `vercel.json` restringindo origens para Supabase, Tailwind, Google Fonts e WhatsApp, bloqueando Clickjacking (`frame-ancestors none`).
5. **Validade de Sessão (TTL de 8h):** Sessões expiradas são invalidadas automaticamente.

### 👥 Usuários e Permissões (RBAC) Cadastrados no Supabase:

#### 🛡️ Administradores Gerais (Acesso Total, Todas as Filiais & Exclusão de Ordens):
- **`erick`** (`erick@vigi.com.br`) • Erick Finger • Role: `admin` • Acesso a ferramentas: **Sim**
- **`daniel`** (`daniel@vigi.com.br`) • Daniel Lazzarotto • Role: `admin` • Acesso a ferramentas: **Sim**
- **`thiago`** (`thiago@vigi.com.br`) • Thiago Graxaim • Role: `admin` • Acesso a ferramentas: **Sim**
- **`klaus`** (`klaus@vigi.com.br`) • Cleverson Klaus • Role: `admin` • Acesso a ferramentas: **Sim**
- **`deivid`** (`deivid@vigi.com.br`) • Deivid • Role: `admin` • Acesso a ferramentas: **Sim**
- **`gabriely`** (`gabriely@vigi.com.br`) • Gabriely • Role: `admin` • Acesso a ferramentas: **Sim**

#### 📍 Operadores de Filiais (Apenas Solicitar & Rastrear Própria Filial • Sem Exclusão):
- **`beltrao1` / `iury`** • Iury (Beltrão) • Role: `filial` • **Acesso a Ferramentas: SIM (com justificativa)**
- **`barracao1` / `giseli`** • Giseli (Barracão) • Role: `filial` • **Acesso a Ferramentas: SIM (com justificativa)**
- **`palotina1` / `adilson`** • Adilson (Palotina) • Role: `filial` • **Acesso a Ferramentas: SIM (com justificativa)**
- **`beltrao2` / `cleverson`** • Cleverson (Beltrão) • Role: `filial` • **Acesso a Ferramentas: BLOQUEADO (apenas suprimentos)**
- **`pato1` / `leonardo`** • Leonardo (Pato) • Role: `filial` • **Acesso a Ferramentas: BLOQUEADO (apenas suprimentos)**
- **`smo1` / `terceiros`** • Terceiros SMO (SMO) • Role: `filial` • **Acesso a Ferramentas: BLOQUEADO (apenas suprimentos)**

---

## 💻 5. Estrutura de Dados (Schemas JSON)

### Objeto de Pedido de Envio (`pedidosEnvio`):
```json
{
  "id": "ENV-101",
  "filial": "Francisco Beltrão",
  "solicitante": "Jean Carlos (Líder Beltrão)",
  "urgencia": "Alta",
  "data": "08/10/2026 09:30",
  "obs": "Instalação de novo sistema de monitoramento.",
  "status": "aguardando",
  "itens": [
    { "nome": "Câmera Bullet Hikvision ColorVu", "qtd": 4 },
    { "nome": "DVR Hikvision 4CH", "qtd": 1 },
    { "nome": "Caixa de Cabo de Rede", "qtd": 1 },
    { "nome": "Conector RJ45", "qtd": 20 }
  ]
}
```
*Status possíveis de Envio:* `'aguardando'` | `'separando'` | `'coleta'` | `'enviado'` | `'chegou'`

### Objeto de Solicitação de Compra (`pedidosCompra`):
```json
{
  "id": "COM-201",
  "item": "Conector RJ45",
  "qtd": 500,
  "solicitante": "Roberto (Estoque Matriz)",
  "urgencia": "Alta",
  "data": "08/10/2026 08:30",
  "obs": "Consumo alto em todas as filiais. Restam menos de 60 na matriz.",
  "status": "solicitado"
}
```
*Status possíveis de Compras:* `'solicitado'` | `'comprado'` | `'emestoque'`

---

## 🛠️ 6. Roteiro para o Próximo Desenvolvedor (Next Steps)

Para transformar este protótipo funcional em uma aplicação corporativa multiusuário conectada na nuvem, recomenda-se os seguintes passos:

### Passo 1: Conectar a um Backend / Banco em Nuvem
Substituir o `localStorage` por um banco de dados real para que as filiais vejam as atualizações em tempo real:
- **Opção Rápida (Low-Code / Serverless):** **Supabase** (PostgreSQL + Realtime) ou **Firebase Firestore**. Com isso, quando Beltrão cadastrar um pedido, o card aparece automaticamente na tela do almoxarife sem precisar de refresh.
- **Opção API Tradicional:** Criar uma API REST ou GraphQL em **Node.js (Nest/Express)**, **Python (FastAPI)** ou **C# (.NET)** com banco relacional (PostgreSQL / MySQL).

### Passo 2: Níveis de Acesso e Autenticação (RBAC)
Implementar login para segmentar as telas:
- **Perfil Filial:** Acessa apenas a tela de solicitação de materiais e visualiza os pedidos da sua própria filial (ex: usuário de Palotina só vê Palotina).
- **Perfil Almoxarife (Matriz):** Acessa todas as colunas de separação, impressão de romaneio e tem permissão para abrir pedidos de compra.
- **Perfil Compras / Diretoria:** Gerencia cotações, pedidos com fornecedores e abastecimento.

### Passo 3: Controle de Saldo de Estoque Central
- Criar tabela de `estoque_atual` e `estoque_minimo`.
- Ao mover um pedido para `'enviado'` ou `'chegou'`, abater automaticamente do estoque central.
- Disparar um alerta ou criar automaticamente um card em *Solicitação de Compra* quando o estoque atingir o nível mínimo.

### Passo 4: Notificação Automática via WhatsApp (Webhooks)
- Atualmente, o sistema gera o texto formatado e copia para o clipboard.
- Pode-se integrar com uma API de WhatsApp (ex: **Evolution API**, **Z-API** ou **Baileys**) para que o sistema dispare automaticamente a mensagem no grupo da filial no momento exato em que o status mudar para `'enviado'`.

---

## 🚀 Como Executar Localmente
Não é necessário instalar nenhum ambiente ou servidor Node.js para testar o protótipo:
1. Abra a pasta do projeto.
2. Dê dois cliques em `index.html` (Desktop Matriz) ou `solicitar.html` (Mobile Técnicos) no seu navegador.
3. Para executar a suíte completa de testes automatizados:
   ```bash
   npm test
   ```

---

## 📜 7. Histórico de Decisões Técnicas & Evolução Recente

### V1.2.4 (Estabilidade de Modais & Correção de Fechamento Instantâneo)
- **Diagnóstico do Problema:** Ao clicar para inspecionar/visualizar um pedido tanto no desktop quanto no celular, o modal abria e sumia em milissegundos (*ghost-click* / *tap-through*). O backdrop (`fixed inset-0`) tornava-se visível no mesmo frame do evento de clique, capturando o disparo do `click` e disparando imediatamente `closeModal()`.
- **Proteção Anti-Ghost-Click Tripla:**
  1. **Debounce Temporal (350ms):** Clicar no backdrop nos primeiros 350ms após a exibição do modal é categoricamente ignorado.
  2. **Verificação de Origem Pointer (`mousedown`):** Só fecha se o `mousedown` começou exatamente no backdrop cinza escuro E o `mouseup`/`click` terminou nele.
  3. **Isolamento de Bolha (`event.stopPropagation`):** Cards e sheets internos têm propagação de evento cancelada, impedindo que interações com itens ou rolagem fechem a janela.
- **Resolução de IDs Universal (`findMobileOrder` & `openCardDetails`):** Compatibilidade total com IDs gerados em qualquer formato (`#ENV-XXXXXX`, `ENV-XXXXXX`, prefixo de 6 dígitos ou UUID completo do Supabase).
- **Atualização Otimista no Mobile:** Ao confirmar um novo pedido no mobile, ele é inserido de imediato em `myShipments` e no cache local antes do roundtrip de rede, garantindo abertura instantânea sem espera de sincronização.
- **Testes Automatizados:** Adicionado `scratch/test_order_details_modal.js` cobrindo cenários de ghost-click, clique legítimo, propagação e resolução de IDs.

### V1.2.5 (Migração Serverless Proxy & Blindagem Total de RLS)
- **Remoção de Chaves Expostas:** Chaves `SUPABASE_ANON_KEY` e URLs hardcoded foram completamente expurgadas dos bundles clientes (`index.html` e `solicitar.html`). O script CDN do Supabase JS foi removido.
- **Proxy Serverless com HMAC Bearer Tokens:**
  - Todas as operações CRUD do frontend agora passam pelo proxy serverless `/api/transaction` autenticadas com tokens assinados (HMAC-SHA256, 8h de TTL).
  - O servidor comunica com o Supabase utilizando exclusivamente a `SUPABASE_SERVICE_ROLE_KEY` via bypass de RLS controlado.
  - Rate limiting ativo por IP + usuário no endpoint `/api/login`.
- **Adaptador Leve `db` Shim no Frontend:**
  - Implementação de shim fluente (`db.from(...).select().order().limit().eq().insert().update().delete()`) preservando 100% da sintaxe existente sem alterar a lógica de negócios das interfaces.
  - Suporte a inserts em lote (múltiplos itens em `shipment_items`), operações `PATCH` e remoções seguras por ID.
- **Autenticação e Sessão Integradas:**
  - Token serverless emitido e armazenado de forma segura na autenticação de Desktop e Mobile, com restauração automática de sessão e sincronização na troca de perfis operacionais.
- **Suíte de Testes:** 4 suítes automatizadas verdes cobrindo matriz de permissões de ferramentas, segurança criptográfica, estabilidade de modais e integração do proxy serverless.

### V1.2.6 (Exportação Gerencial CSV & Linha do Tempo Visual do Pedido)
- **Exportação de Relatórios Gerenciais (.CSV com Filtros):**
  - Adicionado botão e modal de exportação no topo da Matriz (`#modal-report-filter`) permitindo filtrar por:
    1. **Período:** Data Inicial e Data Final com inicialização automática dos últimos 30 dias.
    2. **Filial:** "Todas as Filiais" ou filial específica (Beltrão Iury/Cleverson, Palotina, Barracão, Pato Branco, Terceiros SMO).
    3. **Tipo de Registro:** Envios de Materiais (Expedição) ou Solicitações de Compras (Suprimentos).
  - Geração 100% client-side via Blob com separador `;` e **BOM UTF-8 (`\uFEFF`)** para compatibilidade nativa com Microsoft Excel sem corrupção de acentos ou caracteres especiais.
  - Normalizador de datas resiliente (`parseItemDate`) com suporte tanto a timestamps ISO 8601 quanto a strings no padrão brasileiro legadas (`DD/MM/YYYY HH:MM`).
- **Linha do Tempo & Rastreabilidade de Pedidos (Audit Timeline):**
  - No modal de detalhes de romaneio (`#modal-card-details`), foi incorporado um componente visual responsivo em Dark Glassmorphism exibindo o ciclo completo do pedido em 4 etapas:
    1. **Solicitado:** Pedido emitido no sistema com dados do solicitante.
    2. **Separação & Conferência:** Almoxarifado Central (Matriz).
    3. **Despachado (Em Rota):** Transporte em trânsito para a filial.
    4. **Entrega Confirmada:** Recebimento validado no destino.
  - Destaque dinâmico da etapa atual com pulso e borda acentuada, selo de "Concluído" nas fases superadas e tratamento gracioso para registros legados.
- **Validação Automatizada:** Adicionada 5ª suíte de testes (`scratch/test_new_features.js`), validando 100% da integridade do DOM, regras de filtragem, datas e codificação do CSV.
