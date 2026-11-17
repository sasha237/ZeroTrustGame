// Real-Postgres smoke: drives a full 2-player turn + observer flow through the live server.
// Usage: node tools/pg_smoke.mjs  (server expected on :8090 with REPO=pg)
const BASE = process.env.SMOKE_BASE ?? 'http://localhost:8090';
const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, ok: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
};

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* csv etc. */ }
  return { status: res.status, json, text };
}

const run = async () => {
  const suffix = Date.now().toString(36);
  const pw = 'smoke-password-123';

  const hz = await api('GET', '/healthz');
  check('GET /healthz 200 + ok', hz.status === 200 && hz.json?.ok === true, `status=${hz.status}`);

  const regA = await api('POST', '/auth/register', { body: { email: `smoke_a_${suffix}@example.com`, password: pw, displayName: 'SmokeA' } });
  const regB = await api('POST', '/auth/register', { body: { email: `smoke_b_${suffix}@example.com`, password: pw, displayName: 'SmokeB' } });
  check('register A (201 + token)', regA.status === 201 && !!regA.json?.token, `status=${regA.status}`);
  check('register B (201 + token)', regB.status === 201 && !!regB.json?.token, `status=${regB.status}`);
  const tokA = regA.json?.token;
  const tokB = regB.json?.token;

  const create = await api('POST', '/games', { token: tokA, body: { side: 'state' } });
  const game = create.json?.game ?? {};
  check('create game (201 + id + inviteCode)', create.status === 201 && !!game.id && !!game.inviteCode, `status=${create.status}`);
  const gameId = game.id;
  const code = game.inviteCode;

  const join = await api('POST', '/games/join', { token: tokB, body: { code } });
  check('join with code', join.status === 200 && join.json?.game?.status === 'active', `status=${join.status}`);

  const beforeA = await api('GET', `/games/${gameId}`, { token: tokA });
  check('view before: turn 1, state present', beforeA.json?.game?.turn === 1 && !!beforeA.json?.game?.state, `turn=${beforeA.json?.game?.turn}`);

  const ordA = await api('POST', `/games/${gameId}/orders`, { token: tokA, body: { changes: [{ policy: 'intelligence', delta: 1 }] } });
  check('A submits intelligence+1', ordA.status === 200, `status=${ordA.status}`);

  const spyB = await api('GET', `/games/${gameId}`, { token: tokB });
  const spyText = JSON.stringify(spyB.json);
  check('B sees "submitted" flag but NOT order content',
    spyB.json?.game?.opponent?.submitted === true
      && spyB.json?.game?.you?.orders === null
      && (spyB.json?.game?.history?.length ?? -1) === 0
      && !spyText.includes('"delta":1'));

  const ordB = await api('POST', `/games/${gameId}/orders`, { token: tokB, body: { changes: [{ policy: 'recruitment', delta: 1 }] } });
  check('B submits recruitment+1 (resolves)', ordB.status === 200, `status=${ordB.status}`);

  const afterA = await api('GET', `/games/${gameId}`, { token: tokA });
  const hist1 = afterA.json?.game?.history?.find((t) => t.turn === 1);
  check('turn advanced to 2', afterA.json?.game?.turn === 2, `turn=${afterA.json?.game?.turn}`);
  check('history turn 1 resolved with both orders revealed',
    !!hist1 && !!hist1.orders?.state && !!hist1.orders?.terrorist,
    hist1 ? `state=${JSON.stringify(hist1.orders.state.changes)} terrorist=${JSON.stringify(hist1.orders.terrorist.changes)}` : 'missing');
  check('stateAfter snapshot present (turn 1)',
    !!hist1?.stateAfter && typeof hist1.stateAfter.turn === 'number' && typeof hist1.stateAfter.bank?.state === 'number');

  // Observer flow (A-19) against real PG
  const obs = await api('POST', `/games/${gameId}/observer-link`, { token: tokA });
  const obsToken = obs.json?.token;
  check('observer-link created (player-only)', obs.status === 200 && !!obsToken, `status=${obs.status}`);
  const obsView = await api('GET', `/observe/${obsToken}`);
  check('observer view: no "you", no inviteCode, resolved history visible',
    obsView.status === 200
      && obsView.json?.game?.you === null
      && obsView.json?.game?.inviteCode === null
      && (obsView.json?.game?.history?.length ?? -1) >= 1);
  const obsHistory = await api('GET', `/games/${gameId}/history?token=${obsToken}`);
  check('observer history access (resolved turns)', obsHistory.status === 200 && Array.isArray(obsHistory.json?.turns) && obsHistory.json.turns.length >= 1);
  const obsCsv = await api('GET', `/games/${gameId}/export.csv?token=${obsToken}`);
  check('observer CSV export', obsCsv.status === 200 && (obsCsv.text ?? '').startsWith('turn,side,orders'));

  const csv = await api('GET', `/games/${gameId}/export.csv`, { token: tokA });
  const csvText = csv.text ?? '';
  check('CSV export 200 + header', csv.status === 200 && csvText.startsWith('turn,side,orders'), `status=${csv.status}`);
  check('CSV has both sides turn 1 with orders', csvText.includes('1,state,Intelligence+1') && csvText.includes('1,terrorist,Recruitment+1'));

  const bad = await api('GET', `/games/${gameId}`, { token: 'bogus' });
  check('bogus token rejected', bad.status === 401, `status=${bad.status}`);
  const badObs = await api('GET', '/observe/nope0000');
  check('bad observer token rejected', badObs.status === 404, `status=${badObs.status}`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? 'SMOKE PASS' : 'SMOKE FAIL'} — ${results.length - failed.length}/${results.length} checks`);
  process.exit(failed.length === 0 ? 0 : 1);
};

run().catch((e) => { console.error('SMOKE ERROR', e); process.exit(2); });
