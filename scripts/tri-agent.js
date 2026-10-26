#!/usr/bin/env node

/**
 * ============================================================================
 * TRI-AGENT ORCHESTRATOR • SISTEMA VIGI
 * ============================================================================
 * Hub de orquestração e despacho direto entre as 3 Frentes de Inteligência:
 * - Frente 1: Antigravity (Tech Lead & Arquiteto Geral - Chat Principal)
 * - Frente 2: Cline no Antigravity IDE (Operário Especialista de UI & Telas)
 * - Frente 3: Gemini / Antigravity IDE (Especialista Cirúrgico & Inline Assistant)
 *
 * Padrão Erick Ruan Finger • Autonomia Operacional Máxima
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const CLINE_TASK_FILE = path.join(ROOT_DIR, 'CLINE_TASK.md');
const CLINE_RESPONSE_FILE = path.join(ROOT_DIR, 'CLINE_RESPONSE.md');

// Utilitários de Terminal e Notificação macOS
function notifyMac(title, message, sound = 'Glass') {
  try {
    const cleanTitle = title.replace(/"/g, '\\"');
    const cleanMsg = message.replace(/"/g, '\\"');
    execSync(`osascript -e 'display notification "${cleanMsg}" with title "${cleanTitle}" sound name "${sound}"'`);
  } catch (e) {
    // Ignora se não puder emitir notificação
  }
}

function copyToClipboard(text) {
  try {
    const proc = spawn('pbcopy');
    proc.stdin.write(text);
    proc.stdin.end();
  } catch (e) {}
}

function focusAntigravityIde() {
  try {
    execSync(`osascript -e 'tell application "Antigravity IDE" to activate'`, { stdio: 'ignore' });
  } catch (e) {
    try {
      execSync('open -a "Antigravity IDE"', { stdio: 'ignore' });
    } catch (_) {}
  }
}

// Argument Parser Simples
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  return { command, options };
}

// ============================================================================
// COMANDO: dispatch:cline (Frente 2 - Operário de UI)
// ============================================================================
function dispatchCline(opts) {
  const title = opts.title || opts.task || 'Ajuste de Interface / Componente de UI';
  const targetFiles = opts.files || 'index.html';
  const description = opts.desc || opts.description || 'Implementação de componente de tela conforme especificações do Tech Lead.';
  const requirements = opts.reqs || opts.requirements || '- Manter padrão Tailwind CSS e Dark Glassmorphism.\n- Respeitar suporte a Tema Claro e Escuro.\n- Não quebrar IDs existentes nem alterar chamadas de APIs de backend.';
  const timestamp = new Date().toLocaleString('pt-BR');

  const content = `# 📋 CLINE TASK • FRENTE 2 (OPERÁRIO DE UI)
> **Origem:** Frente 1 (Antigravity Tech Lead)  
> **Destino:** Frente 2 (Cline no Antigravity IDE)  
> **Status:** \`[PENDENTE - AGUARDANDO CLINE]\`  
> **Emissão:** ${timestamp}

---

## 🎯 Objetivo da Tarefa
**${title}**

${description}

---

## 📂 Arquivos Alvo
\`\`\`
${targetFiles.split(',').map(f => f.trim()).join('\n')}
\`\`\`

---

## 🛠️ Especificações Técnicas de UI & Regras
${requirements}

---

## 🚦 Critérios de Aceitação & Validação
1. Componentes visuais renderizam sem distorções em Desktop e Mobile.
2. Contraste e cores alinhados tanto em \`class="dark"\` quanto em \`class="light"\`.
3. Todos os botões e interações têm alvos de clique adequados (mínimo 44px em mobile).
4. Zero erros de sintaxe ou tags HTML órfãs.

---

## ⚡ Instruções de Fechamento pelo Cline
Assim que concluir a digitação e validação visual:
1. Altere o status no topo deste arquivo para: \`[CONCLUÍDO]\`.
2. Registre as alterações realizadas em \`CLINE_RESPONSE.md\` para que a **Frente 1 (Antigravity)** possa auditar, rodar \`npm test\` e publicar em produção.
`;

  fs.writeFileSync(CLINE_TASK_FILE, content, 'utf8');

  const clipboardPrompt = `Leia o arquivo CLINE_TASK.md na raiz e execute 100% da tarefa de UI especificada com autonomia total.`;
  copyToClipboard(clipboardPrompt);
  notifyMac('Tri-Agent • Frente 2 (Cline)', `Nova tarefa despachada: ${title}`, 'Glass');
  focusAntigravityIde();

  console.log('\n======================================================');
  console.log('🚀 TAREFA DESPACHADA COM SUCESSO PARA O CLINE!');
  console.log('======================================================');
  console.log(`📌 Arquivo de Tarefa: CLINE_TASK.md`);
  console.log(`📌 Título: ${title}`);
  console.log(`📌 Arquivos Alvo: ${targetFiles}`);
  console.log(`📋 Prompt copiado para a Área de Transferência (Cmd+V)!`);
  console.log(`🔔 Notificação emitida e janela do Antigravity IDE focada.`);
  console.log('======================================================\n');
}

// ============================================================================
// COMANDO: dispatch:ide (Frente 3 - Antigravity IDE Agent Chat)
// ============================================================================
function dispatchIde(opts) {
  const prompt = opts.prompt || opts.p || 'Analise o arquivo aberto e aplique as melhorias necessárias.';
  const files = opts.files || '';

  console.log('\n======================================================');
  console.log('⚡ DISPARANDO PROMPT PARA O ANTIGRAVITY IDE AGENT...');
  console.log('======================================================');
  console.log(`💬 Prompt: "${prompt}"`);

  let cmd = `antigravity-ide chat -m agent -r "${prompt.replace(/"/g, '\\"')}"`;
  if (files) {
    const fileList = files.split(',').map(f => f.trim());
    fileList.forEach(f => {
      cmd += ` -a "${f}"`;
    });
  }

  try {
    execSync(cmd, { stdio: 'inherit' });
    notifyMac('Tri-Agent • Antigravity IDE', 'Prompt despachado para o chat da IDE!', 'Tink');
    focusAntigravityIde();
    console.log('✓ Prompt enviado diretamente para a sessão de Agent da IDE com sucesso!\n');
  } catch (err) {
    console.error('Erro ao acionar antigravity-ide:', err.message);
  }
}

// ============================================================================
// COMANDO: dispatch:inline (Frente 3 - Inline Gemini Cmd+I / Tab)
// ============================================================================
function dispatchInline(opts) {
  const file = opts.file || 'index.html';
  const line = opts.line || '1';
  const instruction = opts.instruction || opts.inst || 'Refatore este trecho mantendo estabilidade e alto contraste.';

  console.log('\n======================================================');
  console.log('🎯 PREPARANDO INLINE GEMINI (Cmd + I / Tab)...');
  console.log('======================================================');
  console.log(`📄 Arquivo: ${file}:${line}`);
  console.log(`💡 Instrução Cirúrgica: "${instruction}"`);

  copyToClipboard(instruction);

  try {
    execSync(`antigravity-ide -r -g "${file}:${line}"`, { stdio: 'ignore' });
    notifyMac('Tri-Agent • Inline Gemini', `${file}:${line} pronto para Cmd+I`, 'Pop');
    focusAntigravityIde();
    console.log('✓ Arquivo focado na linha exata!');
    console.log('📋 Instrução copiada para o clipboard! Pressione Cmd+I e Cmd+V na IDE.\n');
  } catch (err) {
    console.error('Erro ao abrir arquivo na IDE:', err.message);
  }
}

// ============================================================================
// COMANDO: audit (Frente 1 - Tech Lead Auditoria & Qualidade)
// ============================================================================
function auditProject() {
  console.log('\n======================================================');
  console.log('🛡️  AUDITORIA DE QUALIDADE TRI-AGENT (FRENTE 1)');
  console.log('======================================================');

  // 1. Verifica status do CLINE_TASK.md
  if (fs.existsSync(CLINE_TASK_FILE)) {
    const taskContent = fs.readFileSync(CLINE_TASK_FILE, 'utf8');
    const isCompleted = taskContent.includes('[CONCLUÍDO]');
    console.log(`📋 Status CLINE_TASK.md: ${isCompleted ? '✅ CONCLUÍDO' : '⏳ PENDENTE / EM ANDAMENTO'}`);
  } else {
    console.log('ℹ️  Nenhum CLINE_TASK.md ativo no momento.');
  }

  // 2. Verifica se há feedback em CLINE_RESPONSE.md
  if (fs.existsSync(CLINE_RESPONSE_FILE)) {
    console.log('📝 CLINE_RESPONSE.md encontrado:');
    const responseSummary = fs.readFileSync(CLINE_RESPONSE_FILE, 'utf8').split('\n').slice(0, 5).join('\n');
    console.log(responseSummary);
  }

  // 3. Git Status e Diff Resumido
  try {
    const gitStatus = execSync('/usr/bin/git status -s', { encoding: 'utf8' }).trim();
    console.log('\n🔍 Arquivos Modificados no Git:');
    console.log(gitStatus ? gitStatus : '✓ Nenhum arquivo modificado pendente.');
  } catch (e) {}

  // 4. Execução dos testes automatizados
  console.log('\n🧪 Executando suíte de testes automatizados (npm test)...');
  try {
    execSync('npm test', { stdio: 'inherit' });
    console.log('\n🎉 AUDITORIA APROVADA: 100% DOS TESTES VERDES!');
    notifyMac('Tri-Agent • Auditoria Concluída', 'Todos os testes passaram com sucesso! Pronto para deploy.', 'Hero');
  } catch (err) {
    console.error('\n❌ AUDITORIA FALHOU: Regressões detectadas nos testes!');
    notifyMac('Tri-Agent • Auditoria Falhou', 'Regressão detectada nos testes!', 'Basso');
    process.exit(1);
  }
}

// ============================================================================
// COMANDO: status (Visão Geral das 3 Frentes)
// ============================================================================
function showStatus() {
  console.log('\n======================================================');
  console.log('📊 PAINEL DE STATUS • MODELO TRI-AGENT SYNERGY');
  console.log('======================================================');
  console.log('👑 Frente 1 (Antigravity): Tech Lead & Arquiteto [ATIVO]');
  
  let clineStatus = 'Sem tarefa pendente';
  if (fs.existsSync(CLINE_TASK_FILE)) {
    const task = fs.readFileSync(CLINE_TASK_FILE, 'utf8');
    clineStatus = task.includes('[CONCLUÍDO]') ? 'Última tarefa Concluída' : 'Tarefa Pendente de Execução';
  }
  console.log(`👷 Frente 2 (Cline no IDE): Especialista de UI [${clineStatus}]`);
  console.log('🔬 Frente 3 (Gemini / IDE): Assistente Cirúrgico [PRONTO]');

  try {
    const gitBranch = execSync('/usr/bin/git branch --show-current', { encoding: 'utf8' }).trim();
    console.log(`🌿 Branch Ativa: ${gitBranch}`);
  } catch (e) {}
  console.log('======================================================\n');
}

// ============================================================================
// MAIN ROUTER
// ============================================================================
const { command, options } = parseArgs();

switch (command) {
  case 'cline':
  case 'dispatch:cline':
    dispatchCline(options);
    break;

  case 'ide':
  case 'dispatch:ide':
    dispatchIde(options);
    break;

  case 'inline':
  case 'dispatch:inline':
    dispatchInline(options);
    break;

  case 'audit':
    auditProject();
    break;

  case 'status':
    showStatus();
    break;

  default:
    console.log(`
Tri-Agent Synergy Orchestrator • Comandos Disponíveis:

  node scripts/tri-agent.js cline --title "..." --files "..." --desc "..."
      Despacha tarefa de UI para o Cline via CLINE_TASK.md, foca a IDE e copia prompt.

  node scripts/tri-agent.js ide --prompt "..." [--files "..."]
      Executa comando direto no chat Agent do Antigravity IDE.

  node scripts/tri-agent.js inline --file "index.html" --line 150 --instruction "..."
      Abre arquivo na linha exata para refatoração cirúrgica com Cmd+I.

  node scripts/tri-agent.js audit
      Executa bateria completa de validação, integridade e testes automatizados.

  node scripts/tri-agent.js status
      Mostra o estado operacional integrado das 3 frentes.
`);
    break;
}
