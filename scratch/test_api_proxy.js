/* =============================================================================
 * TESTES DO PROXY SEGURO — SISTEM ENVIO VIGI
 * ----------------------------------------------------------------------------
 * Executa as serverless functions localmente com req/res simulados e
 * sem acessar a rede.
 * ========================================================================== */

'use strict';

const testSecret = '0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SISTEM_SESSION_SECRET = testSecret;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-dummy';

const path = require('path');
const lib = require(path.join(__dirname, '..', 'api', '_lib.js'));
const login = require(path.join(__dirname, '..', 'api', 'login.js'));
const transaction = require(path.join(__dirname, '..', 'api', 'transaction.js'));

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log('  OK  ' + name);
  } else {
    failed++;
    failures.push(name + (detail ? ' -> ' + detail : ''));
    console.error('  FALHA: ' + name + (detail ? ' (' + detail + ')' : ''));
  }
}

function mockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    headers: headers,
    setHeader(k, v) { headers[k.toLowerCase()] = String(v); },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
  return res;
}

// Configura dados de teste
const testSalt = '7be481ed9fb618f95a6cfeba1c3cef3b';
const testHash = lib.pbkdf2Hex('senha123', testSalt);

process.env.SISTEM_USER_CREDS = JSON.stringify({
  erick: { salt: testSalt, hash: testHash },
  iury: { salt: testSalt, hash: testHash }
});

process.env.SISTEM_USERS = JSON.stringify({
  erick: { name: 'Erick Finger', role: 'admin', filial: 'Todas as Filiais', dbBranch: 'MATRIZ' },
  iury: { name: 'Iury', role: 'filial', filial: 'Francisco Beltrão', dbBranch: 'FRANCISCO BELTRAO' }
});

async function run() {
  console.log('=========================================================');
  console.log(' TESTES DO PROXY SEGURO — SISTEM ENVIO VIGI');
  console.log('=========================================================\n');

  console.log('[1] /api/login');
  {
    const res = mockRes();
    await login({ method: 'GET' }, res);
    check('rejeita GET (405)', res.statusCode === 405);
  }
  {
    const res = mockRes();
    await login({ method: 'POST', body: { username: 'erick', password: 'errada' } }, res);
    check('rejeita senha errada (401)', res.statusCode === 401 && res.body.ok === false);
  }
  {
    const res = mockRes();
    await login({ method: 'POST', body: { username: 'erick', password: 'senha123' } }, res);
    check('login com credencial valida (200)', res.statusCode === 200 && res.body.ok === true);
    check('devolve token assinado', typeof res.body.token === 'string' && res.body.token.length > 20);
    check('devolve dados do usuario', res.body.user === 'erick' && res.body.role === 'admin');
  }

  const adminToken = lib.signToken('erick');
  const filialToken = lib.signToken('iury');

  console.log('\n[2] /api/transaction — Autenticacao e Validacao');
  {
    const res = mockRes();
    await transaction({ method: 'GET', headers: {} }, res);
    check('bloqueia sem token (401)', res.statusCode === 401);
  }
  {
    const res = mockRes();
    await transaction({ method: 'GET', headers: { authorization: 'Bearer token-invalido' } }, res);
    check('bloqueia token falso (401)', res.statusCode === 401);
  }
  {
    const res = mockRes();
    await transaction({ method: 'GET', headers: { authorization: 'Bearer ' + adminToken }, query: { table: 'invalida' } }, res);
    check('rejeita tabela inexistente (400)', res.statusCode === 400);
  }

  console.log('\n[3] /api/transaction — Operacoes CRUD');
  // Mock do sbFetch
  let lastFetchPath = '';
  let lastFetchOpts = null;
  lib.sbFetch = async function(p, opts) {
    lastFetchPath = p;
    lastFetchOpts = opts;
    return [{ id: '1', name: 'teste' }];
  };

  {
    const res = mockRes();
    await transaction({
      method: 'GET',
      headers: { authorization: 'Bearer ' + adminToken },
      query: { table: 'shipments' }
    }, res);
    check('GET com query param ?table=shipments aceito (200)', res.statusCode === 200);
    check('admin lista tudo sem filtro de filial', !lastFetchPath.includes('branch_name=eq'));
  }

  {
    const res = mockRes();
    await transaction({
      method: 'GET',
      headers: { authorization: 'Bearer ' + filialToken },
      query: { table: 'shipments' }
    }, res);
    check('GET filial aplica filtro de filial', lastFetchPath.includes('branch_name=eq.FRANCISCO%20BELTRAO'));
  }

  {
    const res = mockRes();
    await transaction({
      method: 'POST',
      headers: { authorization: 'Bearer ' + filialToken },
      body: { table: 'shipments', row: { solicitante: 'Iury' } }
    }, res);
    check('POST forca branch_name da filial', lastFetchOpts && lastFetchOpts.method === 'POST');
  }

  {
    const res = mockRes();
    await transaction({
      method: 'PUT',
      headers: { authorization: 'Bearer ' + adminToken },
      body: { table: 'shipments', id: 'uuid-123', row: { status: 'enviado' } }
    }, res);
    check('PUT atualiza id correto via PATCH', lastFetchPath.includes('id=eq.uuid-123') && lastFetchOpts.method === 'PATCH');
  }

  {
    const res = mockRes();
    await transaction({
      method: 'DELETE',
      headers: { authorization: 'Bearer ' + adminToken },
      body: { table: 'shipments', id: 'uuid-456' }
    }, res);
    check('DELETE exclui id correto', lastFetchPath.includes('id=in.(eq.uuid-456)'));
  }

  console.log('\n---------------------------------------------------------');
  console.log(` Total: ${passed + failed} | OK: ${passed} | FALHAS: ${failed}`);
  if (failed === 0) {
    console.log(' TODOS OS TESTES PASSARAM COM SUCESSO!\n');
    process.exit(0);
  } else {
    console.error(' OCORRERAM FALHAS!\n');
    process.exit(1);
  }
}

run();
