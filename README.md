# Quizify

Website kiểm tra trắc nghiệm lớp học với Next.js, Express và PostgreSQL. Hai vai trò: Admin giáo viên/quản trị viên và học sinh. Source và Docker độc lập, không cần project khác hoặc Node/npm trên máy để chạy.

## Chạy trên Docker Desktop for Windows

Mở Docker Desktop, dùng Linux containers. Trong PowerShell tại thư mục project:

```powershell
docker compose up --build -d
docker compose ps
```

Mở http://localhost:8094/user-login hoặc http://localhost:8094/admin-login. Backend và database chỉ nằm trong mạng Docker. Migration và seed demo chạy tự động lần đầu; khởi động lại không reset dữ liệu.

Cũng có thể mở `http://127.0.0.1:8094/user-login` hoặc `http://127.0.0.1:8094/admin-login`. Khi `PUBLIC_ORIGIN` dùng `localhost` hoặc `127.0.0.1`, backend cho phép cả hai hostname trên đúng giao thức và cổng cấu hình; vẫn chặn origin khác/sai cổng và request ghi thiếu header CSRF. Phiên đăng nhập riêng theo địa chỉ; khi đổi hostname có thể cần đăng nhập lại.

| Vai trò | Đăng nhập | Mật khẩu demo |
| --- | --- | --- |
| Admin | admin@quizify.test | Demo12345! |
| Học sinh lớp Demo A | HS001 hoặc hs01@quizify.test | Demo12345! |
| Học sinh có giao riêng | HS002 hoặc hs02@quizify.test | Demo12345! |
| Học sinh lớp Demo B | HS003 hoặc hs03@quizify.test | Demo12345! |

Tất cả tên/tài khoản là dữ liệu giả lập; không sử dụng thông tin thật. HS003 ban đầu chưa được giao bài, dùng demo giới hạn truy cập. Demo có hạn giao bài 30 ngày từ lúc seed; giáo viên tạo giao bài mới khi hết hạn.

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

Database bind mount tại `database/runtime-data`, dữ liệu PostgreSQL nằm trong thư mục con `pgdata`, giữ nguyên khi down/up hoặc tạo lại container. Không xóa thư mục này nếu muốn giữ dữ liệu. Xem `docs/07-deployment-guide.md` để backup/restore/reset có xác nhận. Source và seed không chứa dữ liệu runtime.

## Kiểm thử

```powershell
docker compose --profile test run --build --rm tests
```

Tests dùng database-test riêng trên tmpfs, không ghi/xóa database ứng dụng. Sau khi chạy, dừng database-test nếu không dùng: docker compose --profile test stop database-test.

Kiểm thử giao diện Chromium bằng Docker, không cần cài trình duyệt/Node trên máy:

```powershell
docker compose up --build -d --wait
docker compose --profile e2e run --no-deps --build --rm browser-tests
```

E2E tạo dữ liệu QA giả lập trong ứng dụng; cuối test vô hiệu hóa học sinh QA và lưu trữ đề QA, không xóa lịch sử. Nên chạy trên database demo hoặc bản sao độc lập. Ảnh và JSON kết quả ở `.agent-tmp/browser-tests/`. Bộ chạy E2E yêu cầu PUBLIC_ORIGIN dạng HTTP localhost hoặc 127.0.0.1 đúng APP_PORT; có kịch bản đăng nhập/đăng xuất qua cả hai địa chỉ.

## Hồ sơ kỹ thuật

`docs/02-architecture.md`, `docs/03-api.md`, `docs/04-database-design.md`, `database/design/schema.dbml`, `docs/test-plan.md`, `docs/06-qa-report.md`, `docs/07-deployment-guide.md` và `docs/08-user-guide.md`. Không yêu cầu Git hoặc CI/CD để vận hành.

## Chạy nhanh trên Windows bằng hai file BAT

1. Giải nén toàn bộ source vào thư mục riêng, không chạy trực tiếp bên trong ZIP.
2. Double-click `01-cai-moi-truong.bat` để kiểm tra Windows/WSL 2/Docker Desktop; chỉ chuẩn bị thành phần còn thiếu khi bạn đồng ý. Không tự nâng/hạ Docker hoặc tự khởi động lại Windows.
3. Double-click `02-chay-project.bat` để build, khởi động và mở ứng dụng khi container cùng HTTP đã sẵn sàng. Không cần cài ngôn ngữ lập trình/database/Git trên Windows.

Lần đầu tải image/build có thể lâu hơn 5 phút; không giới hạn tổng thời gian chờ. Ctrl+C để hủy. Script giữ nguyên `.env` và dữ liệu hiện có; chỉ tạo `.env` từ `.env.example` khi chưa có. Nếu cần đổi cổng, sửa `.env` theo hướng dẫn cấu hình của project, không xóa database. Trùng cổng sẽ báo lỗi, không tự đổi cổng. Giữ đầy đủ thư mục `scripts/windows/` đi kèm; không chỉ chép hai BAT riêng lẻ.

Windows cũ có nhánh tương thích Docker cũ được kiểm chứng và cảnh báo rủi ro; không bảo đảm mọi thiết bị đều chạy được. ARM64/32-bit/Windows Server và máy thiếu ảo hóa cần xử lý riêng. Nếu PowerShell chặn script hoặc file tải về bị khóa, liên hệ người hỗ trợ theo chính sách máy; BAT không tự bỏ qua/chỉnh ExecutionPolicy. Mã lỗi: 10 không tương thích, 20 cần chuẩn bị/hủy, 30 chưa xác minh, 40 lỗi ứng dụng, 3010 cần restart thủ công rồi chạy lại file 01.
