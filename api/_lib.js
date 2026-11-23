// Shared helpers (files starting with "_" are not exposed as API routes).
import { createHash, timingSafeEqual } from 'node:crypto';

export function codeOk(given) {
  const expected = process.env.TEACHER_CODE || '';
  if (!expected) return false;
  const a = createHash('sha256').update(String(given || '')).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export const slow = () => new Promise(r => setTimeout(r, 700)); // slows down code guessing

export function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
}
