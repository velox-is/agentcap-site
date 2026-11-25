// One field, one KV write. Deliberately no dependency and no JS framework: the
// whole page is static and this is the only server code.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequestPost({ request, env }) {
  let email;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  } catch {
    return json(400, { error: 'Expected JSON.' });
  }
  if (email === '' || email.length > 254 || !EMAIL.test(email)) {
    return json(400, { error: 'That does not look like an email address.' });
  }

  // Keyed by the address, so a repeat signup overwrites instead of duplicating.
  await env.SIGNUPS.put(`email:${email}`, JSON.stringify({ ts: Date.now() }));
  return json(200, { ok: true });
}

export async function onRequestGet({ env }) {
  const list = await env.SIGNUPS.list({ prefix: 'email:', limit: 1000 });
  return json(200, { count: list.keys.length });
}
