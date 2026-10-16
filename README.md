# Nhịp Cầu Yêu Thương (Vercel + Neon)

Website giới thiệu dự án thiện nguyện, danh sách trại cứu hộ, form đăng ký tình nguyện và trang quản trị. Không dùng Supabase.

## Cấu trúc

```
public/        Giao diện (index.html, admin.html, CSS, JS)
api/           Hàm máy chủ chạy trên Vercel (camps, volunteers, login)
package.json   Thư viện cần dùng (@neondatabase/serverless)
```

## Phần bán hàng

- Trang chủ có mục **Thực đơn**: khách chọn món, bỏ vào giỏ, điền thông tin nhận hàng rồi đặt.
- Khách chọn **Chuyển khoản** sẽ thấy thông tin tài khoản, nội dung chuyển khoản (chính là mã đơn, ví dụ `NC0007`) và mã QR.
- Khách chọn **Thanh toán khi nhận hàng** thì không cần chuyển khoản.
- Giá luôn được máy chủ tính lại từ thực đơn, khách không sửa giá được.
- Website **không tự biết** khi tiền đã vào tài khoản. Bạn đối chiếu sao kê ngân hàng với mã đơn rồi chuyển trạng thái đơn sang **Đã thanh toán** trong trang admin.

Việc cần làm sau khi deploy, trong `/admin.html`:
1. Mục **Thông tin thanh toán**: nhập tên ngân hàng, số tài khoản, tên chủ tài khoản. Nhập thêm **mã ngân hàng** (VD: VCB, MB, ACB, TCB) để có mã QR. Bỏ trống mã thì khách chỉ thấy thông tin chữ.
2. Mục **Thực đơn**: sửa hoặc xóa 3 món mẫu, thêm món thật, đổi giá, tắt bán từng món.
3. Mục **Đơn hàng**: xem đơn mới, đổi trạng thái (Chờ xử lý, Đã thanh toán, Đã giao, Đã hủy).

Mã QR được tạo bởi dịch vụ VietQR (`img.vietqr.io`) ngay trên trình duyệt của khách. Nếu dịch vụ này lỗi, khách vẫn thấy đầy đủ thông tin chuyển khoản bằng chữ.

## Quá trình thực hiện dự án

- Trong `/admin.html`, mục **Thêm mốc tiến độ dự án**: nhập ngày, tiêu đề, nội dung, trạng thái (Đã hoàn thành, Đang thực hiện, Sắp tới) và link ảnh nếu có.
- Trang chủ hiện các mốc thành dòng thời gian, mới nhất ở trên cùng, kèm thanh phần trăm số mốc đã hoàn thành.
- Chưa có mốc nào thì mục này tự ẩn khỏi trang chủ.
- Link ảnh phải bắt đầu bằng `https://`. Website chưa có chỗ tải ảnh lên, nên bạn đưa ảnh lên một nơi lưu ảnh (VD: Imgur, Google Drive đặt chế độ công khai) rồi dán link ảnh trực tiếp vào.
- Ảnh chó mèo ở đầu trang nằm trong `public/img/` (`cho.svg`, `meo.svg`), bạn có thể thay bằng ảnh của riêng mình.

## Đưa lên mạng (miễn phí)

### 1. Tạo database Neon
1. Vào https://neon.tech, đăng nhập, bấm **Create project**.
2. Ở trang dự án, bấm **Connect** và copy chuỗi kết nối (bắt đầu bằng `postgresql://`).
3. Không cần tạo bảng. Website tự tạo bảng `camps` và `volunteers` ở lần chạy đầu tiên.

### 2. Đưa code lên GitHub
Tạo repository mới, upload toàn bộ nội dung thư mục này (trừ `.env` và `node_modules`).

### 3. Import vào Vercel
1. Vào https://vercel.com → **Add New → Project** → chọn repository vừa tạo.
2. **Framework Preset**: Other. Root Directory: để mặc định.
3. Mở mục **Environment Variables**, thêm 3 biến (xem `.env.example`):
   - `DATABASE_URL`: chuỗi kết nối Neon
   - `ADMIN_PASSWORD`: mật khẩu vào trang admin
   - `ADMIN_SECRET`: chuỗi ngẫu nhiên dài từ 32 ký tự trở lên
4. Bấm **Deploy**.

### 4. Dùng thử
- Trang chủ: `https://ten-du-an.vercel.app`
- Trang admin: `https://ten-du-an.vercel.app/admin.html`

Lần đầu mở trang chủ sẽ có 2 trại mẫu, bạn vào admin xóa hoặc thay bằng trại thật.

## Lưu ý
- Gói Vercel Hobby dành cho mục đích phi thương mại. Khi website **bán hàng**, bạn nên đọc kỹ điều khoản của Vercel xem có còn phù hợp không. Nếu không, cần chuyển sang gói trả phí hoặc nơi lưu trữ khác.
- Thông tin khách (tên, số điện thoại, địa chỉ) nằm trong database Neon của bạn. Chỉ ai có mật khẩu admin mới xem được.
- Đổi `ADMIN_PASSWORD` thành mật khẩu mạnh. Phiên đăng nhập admin hết hạn sau 12 giờ.
- Sau khi sửa biến môi trường trên Vercel, cần **Redeploy** để áp dụng.
