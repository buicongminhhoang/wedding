# wedding.hoangbcm.com

Trang web tĩnh chiếu trong lễ cưới Minh Hoàng & Kim Ngân (29.11.2026).

| Đường dẫn | Nội dung |
|---|---|
| `/` | Trang chọn: chiếu màn sao rơi hay slide ảnh cưới |
| `/sao-roi/` | Màn sao rơi với tên cô dâu chú rể |
| `/slide-anh/` | Slide ảnh cưới, tám mẫu, chạy theo nhịp nhạc |
| `/nhac-le/` | Nhạc cho 15 hạng mục của buổi lễ, dùng bởi bảng nhạc trên trang chọn |

Thêm `?ratio=3x2` (hoặc `2x3`, `4x3`, `16x9`) vào sau đường dẫn để mở thẳng theo tỉ lệ màn hình.

## Đưa lên GitHub Pages

1. Tạo một kho trống trên GitHub (ví dụ `wedding`). GitHub Pages ở gói miễn phí yêu cầu kho **công khai**.
2. Trong thư mục này:
   ```
   git remote add origin https://github.com/<tên-github>/wedding.git
   git push -u origin main
   ```
3. Trên GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, chọn nhánh `main`, thư mục `/ (root)`.
4. Ở mục **Custom domain** nhập `wedding.hoangbcm.com` rồi Save (tệp `CNAME` trong kho đã ghi sẵn tên miền này).

## Trỏ tên miền trên Cloudflare

Trong Cloudflare, vào `hoangbcm.com` → **DNS → Records → Add record**:

| Type | Name | Target | Proxy status |
|---|---|---|---|
| CNAME | `wedding` | `<tên-github>.github.io` | DNS only (mây xám) |

Để **DNS only** cho tới khi GitHub cấp xong chứng chỉ, sau đó tick **Enforce HTTPS** trong Settings → Pages.
Nếu muốn bật proxy (mây cam) về sau, đặt SSL/TLS của Cloudflare ở chế độ **Full**, không dùng Flexible.

## Cập nhật nội dung

- Ảnh: đổi tên hoặc thêm file trong `slide-anh/photos`, chạy `python slide-anh/prep.py`.
- Nhạc: bỏ file vào `slide-anh/music`, chạy `python slide-anh/prep.py` (tự đo nhịp bài mới).
- Nhạc buổi lễ (bảng trên trang chọn): bỏ file vào đúng thư mục hạng mục trong `nhac-le/` (ví dụ `nhac-le/06-co-dau/`), chạy `python nhac-le/prep.py`. Bài ưa thích gợi ý sẵn nằm trong biến `FAV` của script đó.
- Sau đó: `git add -A && git commit -m "Cập nhật ảnh và nhạc" && git push`.

Các trang đã đặt `noindex` để công cụ tìm kiếm không lập chỉ mục, nhưng ai có đường dẫn vẫn xem được.
