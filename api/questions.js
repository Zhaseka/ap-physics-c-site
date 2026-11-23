// Shared question bank for the whole class.
// GET  /api/questions            -> { questions: [...], updated }
// POST /api/questions            -> requires header x-teacher-code === TEACHER_CODE
//      { action: "verify" }       -> { ok: true }
//      { questions: [...] }       -> replaces the shared bank
import { put, list, del } from '@vercel/blob';
import { codeOk, slow, parseBody } from './_lib.js';

const PREFIX = 'shared/questions-';
const MAX_QUESTIONS = 3000;
const IMG_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[\w\-./%]+$/i;

async function versions() {
  const { blobs } = await list({ prefix: PREFIX });
  return blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

const str = (v, max) => String(v ?? '').slice(0, max);

function clean(q) {
  if (!q || typeof q !== 'object') return null;
  const opts = Array.isArray(q.opts) ? q.opts.slice(0, 6).map(o => str(o, 2000)) : [];
  const text = str(q.q, 8000).trim();
  if (!text || opts.length < 2) return null;
  const unit = /^(0|[1-9]|1[0-3])$/.test(String(q.unit)) ? String(q.unit) : '0';
  const ans = Number.isInteger(q.ans) && q.ans >= 0 && q.ans < opts.length ? q.ans : null;
  const img = typeof q.img === 'string' && IMG_URL.test(q.img) ? q.img : '';
  return { id: str(q.id, 60) || 's' + Math.random().toString(36).slice(2), unit, q: text, opts, ans, exp: str(q.exp, 8000), img };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const all = await versions();
      if (!all.length) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ questions: [], updated: null });
      }
      const r = await fetch(all[0].url, { cache: 'no-store' });
      const data = await r.json();
      // Short edge cache; the client adds a 15-second bucket to the URL, so new
      // questions show up within ~15 s while keeping Blob list() calls low.
      res.setHeader('Cache-Control', 's-maxage=15');
      return res.status(200).json({ questions: data.questions || [], updated: all[0].uploadedAt });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (!codeOk(req.headers['x-teacher-code'])) {
        await slow();
        return res.status(401).json({ error: 'Wrong teacher code' });
      }
      if (body.action === 'verify') return res.status(200).json({ ok: true });
      if (!Array.isArray(body.questions)) return res.status(400).json({ error: 'questions must be an array' });

      const questions = body.questions.slice(0, MAX_QUESTIONS).map(clean).filter(Boolean);
      const blob = await put(PREFIX + Date.now() + '.json', JSON.stringify({ questions }), {
        access: 'public',
        addRandomSuffix: true,
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      // keep the newest version plus one backup
      const old = (await versions()).filter(b => b.url !== blob.url).slice(1);
      if (old.length) await del(old.map(b => b.url));
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, count: questions.length, updated: new Date().toISOString() });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
