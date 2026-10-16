import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

let _sql;
let _ready;

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Thiếu biến môi trường DATABASE_URL');
  }
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// Tự tạo bảng nếu chưa có, không cần chạy SQL thủ công
export async function ensureTables() {
  if (_ready) return _ready;
  const sql = getSql();
  _ready = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS camps (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        description TEXT,
        activities TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS volunteers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        camp TEXT,
        message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price INTEGER NOT NULL DEFAULT 0,
        category TEXT,
        available BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        code TEXT,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT,
        note TEXT,
        method TEXT NOT NULL DEFAULT 'bank',
        status TEXT NOT NULL DEFAULT 'pending',
        items JSONB NOT NULL,
        total BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )`;
  })().catch((e) => {
    _ready = undefined;
    throw e;
  });
  return _ready;
}

/* ---------- Đăng nhập admin (token ký HMAC, không cần database) ---------- */

function secret() {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) throw new Error('Thiếu hoặc quá ngắn biến môi trường ADMIN_SECRET');
  return s;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function createToken(hours = 12) {
  const exp = Date.now() + hours * 3600 * 1000;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function isAdmin(req) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    if (!safeEqual(sig, sign(payload))) return false;
    return Number(payload) > Date.now();
  } catch {
    return false;
  }
}

export function json(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store');
  res.json(body);
}

export function readBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b;
}

export const clip = (v, n) => String(v ?? '').trim().slice(0, n);

/* ---------- Thông tin thanh toán (admin nhập, khách xem khi đặt hàng) ---------- */

export const PAYMENT_KEYS = ['bank_name', 'bank_code', 'account_number', 'account_name', 'payment_note'];

export async function getPaymentSettings(sql) {
  const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${PAYMENT_KEYS})`;
  const out = Object.fromEntries(PAYMENT_KEYS.map((k) => [k, '']));
  for (const r of rows) out[r.key] = r.value || '';
  return out;
}
