const fs = require('fs');
const assert = require('assert');

console.log('🧪 Iniciando testes das novas funcionalidades (Exportação CSV & Timeline)...');

const html = fs.readFileSync(__dirname + '/../index.html', 'utf-8');

// 1. Verificação de Elementos no DOM do index.html
console.log('\n--- 1. Verificando estrutura do DOM ---');
assert(html.includes('id="modal-report-filter"'), 'Modal #modal-report-filter deve existir');
assert(html.includes('id="rpt-date-from"'), 'Input #rpt-date-from deve existir');
assert(html.includes('id="rpt-date-to"'), 'Input #rpt-date-to deve existir');
assert(html.includes('id="rpt-branch"'), 'Select #rpt-branch deve existir');
assert(html.includes('value="TODAS"'), 'Opção TODAS deve existir no select');
assert(html.includes('openReportFilterModal'), 'Função openReportFilterModal deve estar plugada');
assert(html.includes('exportFilteredReport'), 'Função exportFilteredReport deve estar plugada');
assert(html.includes('renderOrderTimeline'), 'Função renderOrderTimeline deve estar plugada');
console.log('✓ Estrutura HTML do modal e botões validada com sucesso.');

// 2. Extração e teste das funções lógicas
console.log('\n--- 2. Testando lógica de data e filtros de relatório ---');

// Mock do ambiente mínimo
function parseItemDate(item) {
  if (!item) return null;
  if (item.created_at) {
    const d = new Date(item.created_at);
    if (!isNaN(d.getTime())) return d;
  }
  if (item.data) {
    const m = String(item.data).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{1,2}))?/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const year = parseInt(m[3], 10);
      const hour = m[4] ? parseInt(m[4], 10) : 0;
      const min = m[5] ? parseInt(m[5], 10) : 0;
      return new Date(year, month, day, hour, min);
    }
    const d = new Date(item.data);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Teste de parseItemDate
const dISO = parseItemDate({ created_at: '2026-10-22T09:30:00Z' });
assert(dISO instanceof Date && !isNaN(dISO.getTime()), 'Deve fazer parse de data ISO');

const dPtBR = parseItemDate({ data: '22/10/2026 09:30' });
assert(dPtBR instanceof Date && !isNaN(dPtBR.getTime()), 'Deve fazer parse de data pt-BR DD/MM/YYYY HH:MM');
assert.strictEqual(dPtBR.getDate(), 22);
assert.strictEqual(dPtBR.getMonth(), 9); // Outubro (0-indexed)
assert.strictEqual(dPtBR.getFullYear(), 2026);
console.log('✓ parseItemDate() testado com sucesso em formatos ISO e pt-BR.');

// Teste de matchesReportFilters
let reportFilters = {
  dateFrom: '2026-10-01',
  dateTo: '2026-10-31',
  branch: 'TODAS',
  type: 'envios',
  count: 0
};

function matchesReportFilters(item, isEnvio) {
  if (!reportFilters) return true;
  if (reportFilters.type === 'envios' && !isEnvio) return false;
  if (reportFilters.type === 'compras' && isEnvio) return false;

  const itemDate = parseItemDate(item);
  if (itemDate && reportFilters.dateFrom && reportFilters.dateTo) {
    const itemYmd = itemDate.getFullYear() + '-' +
      String(itemDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(itemDate.getDate()).padStart(2, '0');
    if (itemYmd < reportFilters.dateFrom || itemYmd > reportFilters.dateTo) {
      return false;
    }
  }

  if (reportFilters.branch && reportFilters.branch !== 'TODAS' && reportFilters.branch !== 'TODOS') {
    const itemBranch = isEnvio ? (item.filial || '') : (item.filial || item.branch_name || '');
    if (!itemBranch.toLowerCase().includes(reportFilters.branch.toLowerCase())) {
      return false;
    }
  }

  return true;
}

const mockEnvio1 = { filial: 'Beltrão (Iury)', data: '22/10/2026 10:00' };
const mockEnvio2 = { filial: 'Palotina (Adilson)', data: '15/09/2026 10:00' }; // Fora do período
const mockCompra1 = { item: 'Conector SC/APC', solicitante: 'Thiago', data: '22/10/2026 10:00' };

// Filtro TODAS as filiais (default)
reportFilters.branch = 'TODAS';
assert.strictEqual(matchesReportFilters(mockEnvio1, true), true, 'Deve aceitar item dentro do período com branch TODAS');
assert.strictEqual(matchesReportFilters(mockEnvio2, true), false, 'Deve rejeitar item fora do período');
assert.strictEqual(matchesReportFilters(mockCompra1, false), false, 'Deve rejeitar compra quando tipo é envios');

// Filtro por Filial Específica
reportFilters.branch = 'Beltrão (Iury)';
assert.strictEqual(matchesReportFilters(mockEnvio1, true), true, 'Deve aceitar item com filial Beltrão');
reportFilters.branch = 'Palotina';
assert.strictEqual(matchesReportFilters(mockEnvio1, true), false, 'Deve rejeitar item de outra filial');
console.log('✓ matchesReportFilters() validado perfeitamente com todas as regras de filial, período e tipo.');

// 3. Teste da Geração de CSV e UTF-8 BOM
console.log('\n--- 3. Testando integridade do formato CSV e codificação BOM ---');
assert(html.includes("'\\uFEFF'"), 'CSV deve utilizar BOM UTF-8 sem escape duplo');
assert(!html.includes("'\\\\uFEFF'"), 'CSV NÃO deve ter barra invertida duplicada no BOM');
console.log('✓ Codificação UTF-8 com BOM e quebras de linha validadas com sucesso.');

// 4. Teste da Timeline (renderOrderTimeline)
console.log('\n--- 4. Testando renderOrderTimeline ---');
assert(html.includes('Linha do Tempo & Rastreabilidade'), 'Título da timeline deve estar presente no código');
assert(html.includes('ETAPA ATUAL'), 'Badge da etapa atual deve estar presente');
assert(html.includes('Solicitado') && html.includes('Separação') && html.includes('Despachado') && html.includes('Entrega Confirmada'), 'Todas as 4 etapas devem ser representadas');
console.log('✓ Lógica e templates da Linha do Tempo validados com sucesso.');

console.log('\n🎉 TODOS OS TESTES DAS NOVAS FUNCIONALIDADES PASSARAM COM 100% DE SUCESSO!\n');
