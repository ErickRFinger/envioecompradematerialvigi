# 🤖 Tri-Agent Synergy • Guia Operacional de Execução Autônoma
> **Padrão Erick Ruan Finger • Orquestração Integrada em 3 Frentes de Inteligência**

---

## 1. Visão Geral das 3 Frentes

O ecossistema opera sob o modelo colaborativo de três inteligências especializadas para maximizar a velocidade, a segurança e o reaproveitamento de 100% dos recursos:

```
                  ┌────────────────────────────────────────┐
                  │        FRENTE 1: ANTIGRAVITY           │
                  │   (Tech Lead & Arquiteto Geral)        │
                  │    • Chat Principal (Antigravity 2.0)  │
                  │    • APIs, Banco, Segurança & Deploy   │
                  └───────────────────┬────────────────────┘
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│        FRENTE 2: CLINE               │     │   FRENTE 3: GEMINI / IDE ASSISTANT   │
│   (Operário de UI & Telas)           │     │   (Especialista Cirúrgico & Inline)  │
│    • Barra lateral do Antigravity IDE│     │    • Editor aberto (Cmd + I / Tab)   │
│    • Executa CLINE_TASK.md           │     │    • antigravity-ide chat CLI        │
│    • Gera CLINE_RESPONSE.md          │     │    • Micro-interações e refatorações │
└──────────────────────────────────────┘     └──────────────────────────────────────┘
```

---

## 2. Comandos do Orquestrador (`scripts/tri-agent.js`)

Todos os comandos podem ser acionados diretamente pelo terminal ou pelo próprio Antigravity:

### 🚀 Frente 2: Despachar Tarefa de UI para o Cline
```bash
npm run tri:cline -- --title "Novo Card de Romaneio" --files "index.html" --desc "Criar card estilizado em Tailwind"
```
**O que o comando faz automaticamente:**
1. Escreve a especificação estruturada em `CLINE_TASK.md` com status `[PENDENTE - AGUARDANDO CLINE]`.
2. Copia o prompt de ativação para a área de transferência do macOS (`pbcopy`).
3. Emite uma notificação nativa no macOS com sinal sonoro.
4. Foca automaticamente a janela do **Antigravity IDE** na tela.
5. O Cline lê o arquivo, executa a UI, altera o status para `[CONCLUÍDO]` e registra o feedback em `CLINE_RESPONSE.md`.

---

### ⚡ Frente 3: Disparar Comando Direto para o Antigravity IDE Agent
```bash
npm run tri:ide -- --prompt "Adicione um tooltip explicativo no botão de impressão de romaneio" --files "index.html"
```
**O que o comando faz automaticamente:**
1. Invoca o binário oficial `antigravity-ide chat -m agent -r "<prompt>" -a "<files>"`.
2. O Antigravity IDE abre a sessão de chat em modo Agent já executando a instrução no arquivo aberto.
3. Notifica e foca a IDE.

---

### 🎯 Frente 3: Abrir Arquivo e Linha Exata para Gemini Inline (`Cmd + I` / `Tab`)
```bash
npm run tri:inline -- --file "index.html" --line 450 --instruction "Refatore este seletor CSS para alto contraste"
```
**O que o comando faz automaticamente:**
1. Abre o arquivo na linha exata dentro do Antigravity IDE (`antigravity-ide -r -g file:line`).
2. Copia a instrução cirúrgica para a área de transferência (basta teclar `Cmd + I` e colar).
3. Notifica e foca a IDE.

---

### 🛡️ Frente 1: Auditoria Técnica e Validação de Qualidade
```bash
npm run tri:audit
```
**O que o comando faz automaticamente:**
1. Audita o status de `CLINE_TASK.md` e lê `CLINE_RESPONSE.md`.
2. Avalia `git status` e `git diff` de arquivos modificados.
3. Roda a bateria completa de 8 testes automatizados (`npm test`).
4. Garante zero erros de compilação, sintaxe JS e tags HTML.
5. Notifica o Tech Lead com o status final para autorizar commit e deploy.

---

### 📊 Painel de Status Integrado
```bash
npm run tri:status
```
Exibe o estado operacional instantâneo das 3 frentes e da branch Git ativa.

---

## 3. Protocolo de Arquivos de Integração

| Arquivo | Criado por | Lido por | Finalidade |
|---|---|---|---|
| `CLINE_TASK.md` | Antigravity (F1) | Cline (F2) | Especificação detalhada de UI e regras de tela |
| `CLINE_RESPONSE.md` | Cline (F2) | Antigravity (F1) | Resumo do que foi construído pelo Cline |
| `.clinerules` | Configuração | Cline (F2) | Regras operacionais para o Cline agir como operário de UI |
| `scripts/tri-agent.js` | Antigravity (F1) | Todos | Motor CLI de despacho, notificações e controle |
