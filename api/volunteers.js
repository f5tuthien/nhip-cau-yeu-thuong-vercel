import { getSql, ensureTables, isAdmin, json, readBody, clip } from './_lib.js';

export default async function handler(req, res) {
  try {
    await ensureTables();
    const sql = getSql();

    // Gửi đơn đăng ký (công khai)
    if (req.method === 'POST') {
      const b = readBody(req);

      // Ô bẫy spam: bot hay điền, người thật thì không
      if (b.website) return json(res, 200, { ok: true });

      const name = clip(b.name, 120);
      const phone = clip(b.phone, 30);
      const email = clip(b.email, 160);
      const camp = clip(b.camp, 160);
      const message = clip(b.message, 1000);

      if (!name || !phone) return json(res, 400, { error: 'Cần nhập họ tên và số điện thoại' });
      if (!/^[0-9+\-\s().]{6,30}$/.test(phone)) return json(res, 400, { error: 'Số điện thoại không hợp lệ' });
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: 'Email không hợp lệ' });

      await sql`
        INSERT INTO volunteers (name, phone, email, camp, message)
        VALUES (${name}, ${phone}, ${email}, ${camp}, ${message})`;
      return json(res, 201, { ok: true });
    }

    // Xem / xóa đơn: chỉ admin
    if (!isAdmin(req)) return json(res, 401, { error: 'Chưa đăng nhập' });

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, name, phone, email, camp, message, created_at
        FROM volunteers ORDER BY id DESC LIMIT 500`;
      return json(res, 200, rows);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      await sql`DELETE FROM volunteers WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Phương thức không hợp lệ' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Lỗi máy chủ. Kiểm tra DATABASE_URL.' });
  }
}
