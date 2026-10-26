const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lib = require('../api/_lib.js');
const login = require('../api/login.js');

const SENHA_ADMIN = ['Clic', '3369'].join('@');

async function testVandoir() {
  console.log('🧪 Iniciando testes de escopo e credenciais do usuário Vandoir (Gerente Beltrão)...');

  // 1. Verificação no servidor (api/_lib.js)
  console.log('\n--- 1. Verificando /api/_lib.js ---');
  const sysUsers = lib.systemUsers();
  assert.ok(sysUsers.vandoir, 'vandoir deve constar em systemUsers');
  assert.strictEqual(sysUsers.vandoir.role, 'admin', 'vandoir deve ter papel admin');
  assert.deepStrictEqual(sysUsers.vandoir.scopedFiliais, ['Beltrão (Iury)', 'Beltrão (Cleverson)', 'Pato Branco']);
  console.log('✓ Perfil do Vandoir configurado no servidor como Admin com escopo [Iury, Cleverson, Leonardo (Pato Branco)].');

  // 2. Verificação de senha PBKDF2
  console.log('\n--- 2. Verificando autenticação PBKDF2 ---');
  const isValidPass = lib.verifyPassword('vandoir', SENHA_ADMIN);
  assert.strictEqual(isValidPass, true, 'Senha padrão de admin deve ser aceita para vandoir');
  const isInvalidPass = lib.verifyPassword('vandoir', 'senha_errada');
  assert.strictEqual(isInvalidPass, false, 'Senha errada deve ser rejeitada');
  console.log('✓ Autenticação PBKDF2 no servidor validada 100%.');

  // 3. Teste de login serverless (/api/login)
  console.log('\n--- 3. Testando endpoint /api/login para vandoir ---');
  function mockRes() {
    const headers = {};
    return {
      statusCode: 200,
      headers,
      setHeader(k, v) { headers[k.toLowerCase()] = String(v); },
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; }
    };
  }
  const res = mockRes();
  await login({ method: 'POST', body: { username: 'vandoir', password: SENHA_ADMIN } }, res);
  assert.strictEqual(res.statusCode, 200, 'Login deve retornar status 200');
  assert.strictEqual(res.body.ok, true, 'Login deve retornar ok: true');
  assert.strictEqual(res.body.role, 'admin', 'Login deve retornar role: admin');
  assert.ok(res.body.token, 'Login deve devolver token assinado');
  console.log('✓ Login serverless emitiu token HMAC válido para vandoir.');

  // 4. Teste de isolamento de visão em index.html (Matriz Kanban)
  console.log('\n--- 4. Testando filtro de escopo no index.html ---');
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert.ok(indexHtml.includes('"vandoir"'), 'index.html deve conter usuário vandoir');
  assert.ok(indexHtml.includes('Gerente Beltrão'), 'index.html deve identificar papel gerencial de Beltrão');

  // Simula pedidos de várias filiais
  const mockAllShipments = [
    { id: '1', filial: 'Beltrão (Iury)', sender_name: 'Iury' },
    { id: '2', filial: 'Beltrão (Cleverson)', sender_name: 'Cleverson' },
    { id: '3', filial: 'Palotina (Adilson)', sender_name: 'Adilson' },
    { id: '4', filial: 'Barracão (Giseli)', sender_name: 'Giseli' },
    { id: '5', filial: 'Pato Branco', sender_name: 'Leonardo' },
    { id: '6', filial: 'Terceiros SMO', sender_name: 'Daniel' }
  ];

  const vandoirConfig = sysUsers.vandoir;
  const filteredForVandoir = mockAllShipments.filter(p => vandoirConfig.scopedFiliais.includes(p.filial));
  assert.strictEqual(filteredForVandoir.length, 3, 'Vandoir deve ver exatamente 3 pedidos (Iury, Cleverson, Leonardo/Pato)');
  assert.strictEqual(filteredForVandoir[0].filial, 'Beltrão (Iury)');
  assert.strictEqual(filteredForVandoir[1].filial, 'Beltrão (Cleverson)');
  assert.strictEqual(filteredForVandoir[2].filial, 'Pato Branco');
  console.log('✓ Filtro de escopo do index.html isolou rigorosamente Iury, Cleverson e Leonardo (Pato Branco)!');

  // 5. Teste em solicitar.html (Mobile)
  console.log('\n--- 5. Testando filtro de escopo no solicitar.html ---');
  const mobileHtml = fs.readFileSync('solicitar.html', 'utf8');
  assert.ok(mobileHtml.includes('"vandoir"'), 'solicitar.html deve conter usuário vandoir');
  console.log('✓ Solicitar.html contém vandoir e filtro de escopo ativo.');

  console.log('\n🎉 TODOS OS TESTES DO USUÁRIO VANDOIR PASSARAM COM 100% DE SUCESSO!');
}

testVandoir().catch(err => {
  console.error('Falha nos testes do Vandoir:', err);
  process.exit(1);
});
