import { getSql, ensureTables, isAdmin, json, readBody, clip } from './_lib.js';

const SEED = [
  ['Trại cứu hộ Mái Ấm Bốn Chân', 'TP. Hồ Chí Minh', 'Nơi nuôi dưỡng chó mèo bị bỏ rơi, cần người dọn vệ sinh, tắm rửa và chơi cùng các bé.', 'Chăm sóc thú cưng'],
  ['Trại cứu hộ Hy Vọng', 'Đồng Nai', 'Cần thực phẩm, thuốc men và tình nguyện viên cuối tuần.', 'Quyên góp & hỗ trợ'],
];

export default async function handler(req, res) {
  try {
    await ensureTables();
    const sql = getSql();

    // Ai cũng xem được danh sách
    if (req.method === 'GET') {
      // Lần đầu chạy: thêm vài trại mẫu để web không trống. Chỉ thêm một lần,
      // nên sau khi admin xóa hết thì trại mẫu không tự quay lại.
      const [seeded] = await sql`SELECT value FROM settings WHERE key = 'camps_seeded'`;
      if (!seeded) {
        const [{ n: existing }] = await sql`SELECT count(*)::int AS n FROM camps`;
        if (existing === 0) {
          for (const [n, l, d, a] of SEED) {
            await sql`INSERT INTO camps (name, location, description, activities) VALUES (${n}, ${l}, ${d}, ${a})`;
          }
        }
        await sql`INSERT INTO settings (key, value) VALUES ('camps_seeded', '1') ON CONFLICT (key) DO NOTHING`;
      }
      const rows = await sql`SELECT id, name, location, description, activities FROM camps ORDER BY id DESC`;
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      return res.status(200).json(rows);
    }

    // Từ đây trở xuống chỉ admin được dùng
    if (!isAdmin(req)) return json(res, 401, { error: 'Chưa đăng nhập' });

    if (req.method === 'POST') {
      const b = readBody(req);
      const name = clip(b.name, 160);
      if (!name) return json(res, 400, { error: 'Cần nhập tên trại' });
      const location = clip(b.location, 200);
      const description = clip(b.description, 1200);
      const activities = clip(b.activities, 200);
      const [row] = await sql`
        INSERT INTO camps (name, location, description, activities)
        VALUES (${name}, ${location}, ${description}, ${activities})
        RETURNING id, name, location, description, activities`;
      return json(res, 201, row);
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query.id);
      if (!Number.isInteger(id)) return json(res, 400, { error: 'ID không hợp lệ' });
      await sql`DELETE FROM camps WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Phương thức không hợp lệ' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Lỗi máy chủ. Kiểm tra DATABASE_URL.' });
  }
}
