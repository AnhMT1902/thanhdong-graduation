# Quizify

Website kiểm tra trắc nghiệm lớp học với Next.js, Express và PostgreSQL. Hai vai trò: Admin giáo viên/quản trị viên và học sinh. Source và Docker độc lập, không cần project khác hoặc Node/npm trên máy để chạy.

## Chạy trên Docker Desktop for Windows

Bản bàn giao dành cho máy đã cài Docker Desktop và Docker Compose, bật ảo hóa/WSL 2 theo yêu cầu của Docker Desktop và dùng Linux containers. Không cần cài Node.js, npm, PostgreSQL hoặc Git trên Windows.

1. Giải nén toàn bộ ZIP vào thư mục riêng; không chạy trực tiếp trong ZIP.
2. Mở Docker Desktop và đợi Docker Engine sẵn sàng.
3. Mở PowerShell tại thư mục chứa `compose.yaml`, kiểm tra Docker:

```powershell
docker version
docker compose version
```

4. Tạo `.env` từ file mẫu nếu chưa có, không ghi đè cấu hình đang dùng:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
```

5. Build và chạy ứng dụng; lần đầu cần mạng để tải image/dependency, có thể mất vài phút:

```powershell
docker compose up --build -d --wait
docker compose ps
```

6. Khi cả ba service `database`, `backend`, `frontend` đều `healthy`, mở http://localhost:8094/user-login hoặc http://localhost:8094/admin-login. Kiểm tra API bằng `Invoke-RestMethod http://localhost:8094/api/health`, kết quả có `status: ok`. Backend và database chỉ nằm trong mạng Docker. Migration và seed demo chạy tự động lần đầu; khởi động lại không reset dữ liệu.

Cũng có thể mở `http://127.0.0.1:8094/user-login` hoặc `http://127.0.0.1:8094/admin-login`. Khi `PUBLIC_ORIGIN` dùng `localhost` hoặc `127.0.0.1`, backend cho phép cả hai hostname trên đúng giao thức và cổng cấu hình; vẫn chặn origin khác/sai cổng và request ghi thiếu header CSRF. Phiên đăng nhập riêng theo địa chỉ; khi đổi hostname có thể cần đăng nhập lại.

| Vai trò | Đăng nhập | Mật khẩu demo |
| --- | --- | --- |
| Admin | admin@quizify.test | Demo12345! |
| Học sinh lớp Demo A | HS001 hoặc hs01@quizify.test | Demo12345! |
| Học sinh có giao riêng | HS002 hoặc hs02@quizify.test | Demo12345! |
| Học sinh lớp Demo B | HS003 hoặc hs03@quizify.test | Demo12345! |

Tất cả tên/tài khoản là dữ liệu giả lập; không sử dụng thông tin thật. HS003 ban đầu chưa được giao bài, dùng demo giới hạn truy cập. Demo có hạn giao bài 30 ngày từ lúc seed; giáo viên tạo giao bài mới khi hết hạn.

Ngay trên màn đăng nhập có khối **Tài khoản demo**: Admin hiển thị tài khoản giáo viên, Học sinh hiển thị cả ba tài khoản học sinh. Bấm **Điền** để điền tài khoản và mật khẩu mặc định, sau đó bấm **Đăng nhập**. Đây không phải chức năng tạo tài khoản hay bỏ qua xác thực. Mật khẩu có chữ `D` hoa, dấu `!` cuối và không có khoảng trắng. Nếu đã đổi mật khẩu, hãy nhập mật khẩu đã đổi thay cho giá trị được điền sẵn.

Muốn đổi cổng/biến cấu hình, copy .env.example thành .env và chỉnh APP_PORT cùng PUBLIC_ORIGIN cho khớp URL trình duyệt. Các mật khẩu mặc định chỉ phục vụ demo local; không dùng nguyên cấu hình này cho server công cộng. COOKIE_SECURE=true chỉ khi thực sự chạy qua HTTPS. DEMO_PASSWORD chỉ có tác dụng ở lần seed đầu.

## Chức năng

- Admin: tạo/sửa/vô hiệu hóa học sinh, gán lớp; lớp/môn; ngân hàng câu hỏi; đề nháp/xuất bản/lưu trữ; giao nhiều lớp hoặc học sinh; bảng có tìm kiếm/sắp xếp/phân trang, kết quả có bộ lọc.
- Học sinh: chỉ thấy bài được giao, tìm/lọc/sắp xếp/phân trang; bắt đầu/tiếp tục, lưu đáp án/flag, nộp/tự chấm; lịch sử riêng từng giao bài và kết quả tổng hợp; review đúng/sai/chưa làm; hồ sơ/mật khẩu.
- Một học sinh có một lớp chính, một lượt đang làm; submitted không sửa. Server chống truy cập kết quả của người khác và không trả đáp án đúng trước nộp.
- MVP câu hỏi một lựa chọn, thang 10 theo trọng số, không điểm một phần. Hết thời gian server tự nộp. Khi giáo viên tắt review không trả đáp án đúng/giải thích.

## Giao diện

Toàn app dùng giao diện workspace xanh trời/slate và font stack hệ thống, không cưỡng bức tải Inter hoặc font CDN. Dropdown và xác nhận dùng component riêng trong app; bảng sắp xếp trực tiếp bằng tiêu đề cột, có bộ lọc theo nghiệp vụ và phân trang bằng số. Máy tính dùng sidebar có thể thu gọn; màn hẹp dùng menu mở/đóng ở góc trái. Menu tài khoản ở topbar có Hồ sơ/Đăng xuất. Tên đối tượng trong bảng mở trang chi tiết bằng chuột hoặc Enter; nút thao tác vẫn ghi chữ rõ nghĩa.

## Dừng và dữ liệu

```powershell
docker compose down
docker compose up -d
```

Database bind mount tại `database/runtime-data`, dữ liệu PostgreSQL nằm trong thư mục con `pgdata`, giữ nguyên khi down/up hoặc tạo lại container. Không xóa thư mục này nếu muốn giữ dữ liệu. ZIP không kèm database đang sử dụng; chạy bản giải nén mới sẽ tạo dữ liệu demo độc lập. Compose cho PostgreSQL tối đa 2 phút để dừng an toàn khi ổ bind mount trên Windows ghi chậm; đợi lệnh dừng hoàn tất, không tắt cưỡng bức Docker Desktop.

### Sao lưu và khôi phục dữ liệu

Chạy trong thư mục project. File sao lưu chứa dữ liệu đang dùng, cần giữ riêng và không gửi kèm source:

```powershell
docker compose exec -T database pg_dump -U quizify -d quizify -Fc -f /tmp/quizify-backup.dump
docker compose cp database:/tmp/quizify-backup.dump ./quizify-backup.dump
```

Chỉ khôi phục khi đã sao lưu dữ liệu hiện tại và xác nhận thay thế dữ liệu trong database đích. Dừng ứng dụng trong lúc khôi phục:

```powershell
docker compose stop frontend backend
docker compose cp ./quizify-backup.dump database:/tmp/quizify-backup.dump
docker compose exec -T database pg_restore -U quizify -d quizify --clean --if-exists --no-owner /tmp/quizify-backup.dump
docker compose up -d --wait
```

## Xử lý lỗi khi chạy Docker

- Không kết nối được Docker Engine: mở Docker Desktop, đợi sẵn sàng và kiểm tra đang dùng Linux containers.
- Trùng cổng 8094: sửa đồng thời `APP_PORT` và `PUBLIC_ORIGIN` trong `.env`, ví dụ `APP_PORT=18094`, `PUBLIC_ORIGIN=http://localhost:18094`, sau đó chạy lại `docker compose up --build -d --wait` và mở đúng cổng mới. Không xóa database.
- Build/container lỗi: chạy `docker compose ps` và `docker compose logs --tail 100 backend frontend database` để xem nguyên nhân; kiểm tra mạng nếu chưa tải được image/dependency.
- Lần khởi tạo PostgreSQL đầu tiên trên ổ Windows có thể cần vài phút để ghi dữ liệu. Healthcheck có giai đoạn khởi tạo 5 phút và vẫn chỉ báo sẵn sàng sau khi truy vấn database thành công; không tắt Docker khi database đang khởi tạo/phục hồi.
- Đăng nhập sai: dùng đúng trang theo vai trò, bấm Điền hoặc nhập tài khoản trong bảng; xóa giá trị trình duyệt tự điền nếu là mật khẩu cũ. `DEMO_PASSWORD` không đổi mật khẩu của tài khoản đã có. Đăng nhập sai quá nhiều lần cần đợi 15 phút.
- Không chép database/runtime-data giữa các bản source khi PostgreSQL còn chạy; dùng sao lưu/khôi phục nếu cần chuyển dữ liệu.

## Tùy chọn mở nhanh trên Windows

Nếu Docker Desktop đã sẵn sàng, có thể dùng `start.bat`. File chạy trực tiếp `docker compose up --build -d --wait` và `docker compose ps` tại thư mục của nó; chỉ tạo `.env` từ `.env.example` nếu chưa có. Khi các service healthy, mở địa chỉ ứng dụng đã cấu hình. Nếu lệnh Docker thất bại, cửa sổ giữ lại thông báo lỗi; cấu hình và dữ liệu hiện có không bị ghi đè.
