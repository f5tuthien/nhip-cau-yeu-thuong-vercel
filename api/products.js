import { getSql, ensureTables, isAdmin, json, readBody, clip } from './_lib.js';

const SEED = [
  ['Bánh quy yêu thương', 'Bánh quy bơ nướng thủ công, hộp 10 cái.', 35000, 'Đồ ăn'],
  ['Trà chanh mật ong', 'Trà chanh mật ong tươi mát, ly 500ml.', 25000, 'Đồ uống'],
  ['Túi vải Nhịp Cầu', 'Túi vải canvas in logo dự án.', 60000, 'Quà tặng'],
];

const MAX_PRICE = 10_000_000;

function parsePrice(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= MAX_PRICE ? n : null;
}

export default async function handler(req, res) {
  try {
    await ensureTables();
    const sql = getSql();

    if (req.method === 'GET') {
      // Lần đầu chạy: thêm vài món mẫu (chỉ một lần), admin sửa hoặc xóa sau
      const [seeded] = await sql`SELECT value FROM settings WHERE key = 'products_seeded'`;
      if (!seeded) {
        const [{ n: existing }] = await sql`SELECT count(*)::int AS n FROM products`;
        if (existing === 0) {
          for (const [n, d, p, c] of SEED) {
            await sql`INSERT INTO products (name, description, price, category) VALUES (${n}, ${d}, ${p}, ${c})`;
          }
        }
        await sql`INSERT INTO settings (key, value) VALUES ('products_seeded', '1') ON CONFLICT (key) DO NOTHING`;
      }

      // ?all=1 (chỉ admin): xem cả món đã tắt bán
      if (req.query.all === '1') {
        if (!isAdmin(req)) return json(res, 401, { error: 'Chưa đăng nhập' });
        const rows = await sql`
          SELECT id, name, description, price, category, available
          FROM products ORDER BY category, id`;
        return json(res, 200, rows);
      }

      const rows = await sql`
        SELECT id, name, description, price, category
        FROM products WHERE available = true ORDER BY category, id`;
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
      return res.status(200).json(rows);
    }

    // Từ đây trở xuống chỉ admin được dùng
    if (!isAdmin(req)) return json(res, 401, { error: 'Chưa đăng nhập' });

    if (req.method === 'POST') {
      const b = readBody(req);
      const name = clip(b.name, 160);
      const price = parsePrice(b.price);
      if (!name) return json(res, 400, { error: 'Cần nhập tên món' });
      if (price === null) return json(res, 400, { error: 'Giá không hợp lệ (0 đến 10.000.000)' });
      const description = clip(b.description, 600);
      const category = clip(b.category, 60) || 'Khác';
      const [row] = await sql`
        INSERT INTO products (name, description, price, category)
        VALUES (${name}, ${description}, ${price}, ${category})
        RETURNING id, name, description, price, category, available`;
      return json(res, 201, row);
    }

    if (req.method === 'PATCH') {
      const b = readBody(req);
      const id = Number(b.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      if (typeof b.available === 'boolean') {
        await sql`UPDATE products SET available = ${b.available} WHERE id = ${id}`;
      }
      if (b.price !== undefined) {
        const price = parsePrice(b.price);
        if (price === null) return json(res, 400, { error: 'Giá không hợp lệ' });
        await sql`UPDATE products SET price = ${price} WHERE id = ${id}`;
      }
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      await sql`DELETE FROM products WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Phương thức không hợp lệ' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Lỗi máy chủ. Kiểm tra DATABASE_URL.' });
  }
}
