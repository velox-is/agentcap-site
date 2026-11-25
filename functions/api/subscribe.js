// One field, one KV write. Deliberately no dependency and no JS framework: the
// whole page is static and this is the only server code.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// Referrer arrives from the client and is stored, not trusted. Trimmed to a
// length that still distinguishes a subreddit from a search engine.
function clean(value, max) {
  return typeof value === 'string' && value !== '' ? value.slice(0, max) : null;
}

export async function onRequestPost({ request, env }) {
  let email;
  let referrer = null;
  let origin = null;
  try {
    const body = await request.json();
    email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    referrer = clean(body.referrer, 300);
    origin = clean(body.origin, 100);
  } catch {
    return json(400, { error: 'Expected JSON.' });
  }
  if (email === '' || email.length > 254 || !EMAIL.test(email)) {
    return json(400, { error: 'That does not look like an email address.' });
  }

  // Keyed by the address, so a repeat signup overwrites instead of duplicating.
  // The first timestamp and referrer win, so a later visit from another source
  // cannot overwrite the attribution that actually produced the signup.
  const key = `email:${email}`;
  const prior = await env.SIGNUPS.get(key, 'json');
  await env.SIGNUPS.put(
    key,
    JSON.stringify({
      ts: prior?.ts ?? Date.now(),
      referrer: prior?.referrer ?? referrer,
      origin: prior?.origin ?? origin,
      seen: (prior?.seen ?? 0) + 1,
    }),
  );
  return json(200, { ok: true });
}

export async function onRequestGet({ env }) {
  const list = await env.SIGNUPS.list({ prefix: 'email:', limit: 1000 });
  return json(200, { count: list.keys.length });
}
