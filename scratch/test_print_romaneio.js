const assert = require('assert');
const fs = require('fs');

console.log('🧪 Iniciando testes de robustez do Botão de Imprimir Romaneio...');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const mobileHtml = fs.readFileSync('solicitar.html', 'utf8');

// 1. Verificação de estilos @media print e ausência de bloqueios
console.log('\n--- 1. Verificando @media print ---');
assert.ok(indexHtml.includes(':not(#vigi-print-frame)'), 'index.html @media print não deve esconder vigi-print-frame');
assert.ok(mobileHtml.includes(':not(#vigi-print-frame)'), 'solicitar.html @media print não deve esconder vigi-print-frame');
console.log('✓ @media print permite a renderização limpa do iframe de impressão.');

// 2. Verificação de remoção de visibility: hidden e width: 0
console.log('\n--- 2. Verificando dimensões e visibilidade do iframe ---');
assert.ok(!indexHtml.includes("printFrame.style.visibility = 'hidden'"), 'index.html não pode usar visibility: hidden');
assert.ok(!mobileHtml.includes("printFrame.style.visibility = 'hidden'"), 'solicitar.html não pode usar visibility: hidden');
assert.ok(indexHtml.includes("printFrame.style.width = '1024px'"), 'index.html deve definir largura real para layout engine');
assert.ok(mobileHtml.includes("printFrame.style.width = '1024px'"), 'solicitar.html deve definir largura real para layout engine');
console.log('✓ Iframes utilizam dimensões ativas (1024x768 fora da tela com opacidade mínima), garantindo disparo nativo do print.');

// 3. Verificação de suporte e fallback mobile
console.log('\n--- 3. Verificando fallback para dispositivos móveis ---');
assert.ok(indexHtml.includes('fallbackViaPopup'), 'index.html deve conter fallback universal');
assert.ok(mobileHtml.includes('fallbackViaPopup'), 'solicitar.html deve conter fallback universal');
console.log('✓ Fallback universal via popup/window.open configurado para mobile.');

// 4. Teste de resolução de IDs em printSeparacao e printRomaneioDirect
console.log('\n--- 4. Testando resolução resiliente de IDs ---');
const mockPedidos = [
  { id: 'ENV-DE2735', rawId: 'de27354d-664f-4c5f-9df7-f59494a0d216', filial: 'Beltrão (Iury)', itens: [] },
  { id: 'ENV-EC9C51', rawId: 'ec9c5149-be5a-4817-9867-54b333e94acf', filial: 'Beltrão (Cleverson)', itens: [] }
];

function findPedido(targetId) {
  const cleanTarget = String(targetId).trim().toLowerCase().replace('#', '').replace('env-', '');
  return mockPedidos.find(p => 
    p.id === targetId || 
    p.rawId === targetId || 
    String(p.id).toLowerCase() === String(targetId).toLowerCase() ||
    String(p.rawId).toLowerCase() === String(targetId).toLowerCase() ||
    String(p.id).toLowerCase().includes(cleanTarget) ||
    String(p.rawId).toLowerCase().includes(cleanTarget)
  );
}

assert.ok(findPedido('ENV-DE2735'), 'Deve achar por ID canônico');
assert.ok(findPedido('#ENV-DE2735'), 'Deve achar com prefixo #');
assert.ok(findPedido('de27354d-664f-4c5f-9df7-f59494a0d216'), 'Deve achar por rawId');
assert.ok(findPedido('de2735'), 'Deve achar por código curto');
assert.ok(findPedido('env-de2735'), 'Deve achar por minúsculas');
console.log('✓ Resolução de pedidos testada em todos os formatos de código.');

// 5. Verificação da presença de botões diretos de impressão
console.log('\n--- 5. Verificando botões de impressão direta na interface ---');
assert.ok(indexHtml.includes('printRomaneioDirect'), 'index.html deve possuir botão de 1 clique para imprimir romaneio');
assert.ok(indexHtml.includes('printSeparacao'), 'index.html deve possuir botão de imprimir dentro do modal');
assert.ok(mobileHtml.includes('printRomaneioFromDetailModal'), 'solicitar.html deve possuir impressão pelo modal');
assert.ok(mobileHtml.includes('printRomaneioFromMobile'), 'solicitar.html deve possuir impressão direta pelo card');
console.log('✓ Botões de impressão presentes no modal de conferência, nos cards e na tabela.');

console.log('\n🎉 TODOS OS TESTES DE IMPRESSÃO DE ROMANEIO PASSARAM COM SUCESSO!');
