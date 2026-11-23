// Test results of students.
// POST { action: "submit", result }            -> anyone (students); one file per submission
// GET                                          -> teacher only; all results
// POST { action: "delete", name } / { all }    -> teacher only
import { put, list, del } from '@vercel/blob';
import { createHash } from 'node:crypto';
import { codeOk, slow, parseBody } from './_lib.js';

const nameKey = n => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
const folder = n => 'results/' + createHash('sha256').update(nameKey(n)).digest('hex').slice(0, 16) + '/';
const str = (v, max) => String(v ?? '').slice(0, max);
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

function cleanResult(r) {
  if (!r || typeof r !== 'object') return null;
  const name = str(r.name, 60).trim().replace(/\s+/g, ' ');
  if (name.length < 2 || !Array.isArray(r.items) || !r.items.length) return null;
  const items = r.items.slice(0, 200).map(x => ({
    id: str(x && x.id, 60),
    unit: /^(0|[1-9]|1[0-3])$/.test(String(x && x.unit)) ? String(x.unit) : '0',
    q: str(x && x.q, 200),
    chosen: int(x && x.chosen, 0, 5),
    ans: int(x && x.ans, 0, 5),
  }));
  items.forEach(x => { x.ok = x.chosen != null && x.chosen === x.ans; });
  const units = {};
  for (const x of items) {
    units[x.unit] = units[x.unit] || { n: 0, r: 0 };
    units[x.unit].n++;
    if (x.ok) units[x.unit].r++;
  }
  const at = isNaN(Date.parse(r.at)) ? new Date().toISOString() : new Date(r.at).toISOString();
  return {
    name, at, items, units,
    total: items.length,
    correct: items.filter(x => x.ok).length,
    seconds: int(r.seconds, 0, 86400) ?? 0,
    timed: !!r.timed,
  };
}

async function fetchAll(blobs) {
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const batch = await Promise.all(blobs.slice(i, i + 25).map(b =>
      fetch(b.url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null)));
    out.push(...batch.filter(Boolean));
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      if (!codeOk(req.headers['x-teacher-code'])) { await slow(); return res.status(401).json({ error: 'Wrong teacher code' }); }
      const results = await fetchAll(await listAll('results/'));
      results.sort((a, b) => (a.at < b.at ? 1 : -1));
      return res.status(200).json({ results });
    }
    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.action === 'submit') {
        const r = cleanResult(body.result);
        if (!r) return res.status(400).json({ error: 'Invalid result' });
        await put(folder(r.name) + Date.now() + '.json', JSON.stringify(r), {
          access: 'public', addRandomSuffix: true, contentType: 'application/json',
        });
        return res.status(200).json({ ok: true });
      }
      if (body.action === 'delete') {
        if (!codeOk(req.headers['x-teacher-code'])) { await slow(); return res.status(401).json({ error: 'Wrong teacher code' }); }
        if (!body.all && !nameKey(body.name)) return res.status(400).json({ error: 'name required' });
        const blobs = await listAll(body.all ? 'results/' : folder(body.name));
        for (let i = 0; i < blobs.length; i += 100) await del(blobs.slice(i, i + 100).map(b => b.url));
        return res.status(200).json({ ok: true, deleted: blobs.length });
      }
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
