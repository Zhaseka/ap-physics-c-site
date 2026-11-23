// POST /api/upload  (teacher only)
// body: { type: "image/jpeg" | "image/png" | "image/webp" | "image/gif", data: "<base64>" }
// -> { url }
import { put } from '@vercel/blob';
import { codeOk, slow, parseBody } from './_lib.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_BYTES = 3 * 1024 * 1024;

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    if (!codeOk(req.headers['x-teacher-code'])) {
      await slow();
      return res.status(401).json({ error: 'Wrong teacher code' });
    }
    const { type, data } = parseBody(req);
    const ext = TYPES[type];
    if (!ext || typeof data !== 'string') return res.status(400).json({ error: 'Unsupported image' });
    const buf = Buffer.from(data, 'base64');
    if (!buf.length || buf.length > MAX_BYTES) return res.status(413).json({ error: 'Image is too large (max 3 MB)' });
    const blob = await put(`images/figure.${ext}`, buf, {
      access: 'public',
      addRandomSuffix: true,
      contentType: type,
      cacheControlMaxAge: 31536000,
    });
    return res.status(200).json({ url: blob.url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
