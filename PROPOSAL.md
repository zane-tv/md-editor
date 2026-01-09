# Báo cáo Rà soát Codebase và Đề xuất Tính năng - Markiva

Sau khi rà soát toàn bộ source code của dự án Markiva, tôi xin gửi bản phân tích và các đề xuất cải tiến như sau:

## 1. Phân tích Hiện trạng (Code Audit)

### Tổng quan
Dự án là một ứng dụng React + Vite + TailwindCSS dùng để soạn thảo Markdown và xuất bản sang Google Docs.
- **Dependencies chính:** `react-markdown` (render), `mermaid` (biểu đồ), `gapi-script` (Google API).
- **Cấu trúc:** Code tập trung chủ yếu tại `src/App.tsx` (~500 dòng) và logic export tại `src/utils/exportToDocs.ts`.

### Điểm mạnh
- **Tính năng Export mạnh mẽ:** Logic xử lý AST (Abstract Syntax Tree) để convert Markdown sang Google Docs API rất chi tiết (xử lý được Table, Image, Heading, Mermaid charts).
- **Giao diện:** Sạch sẽ, hiện đại, hỗ trợ Dark/Light mode.
- **Công cụ:** Toolbar đầy đủ các chức năng format cơ bản.

### Điểm hạn chế
- **Code Monolithic:** File `App.tsx` quá lớn, chứa lẫn lộn cả UI layout, logic xử lý text, logic resize split-view và logic gọi API. Điều này gây khó khăn cho việc bảo trì và mở rộng.
- **Trải nghiệm người dùng (UX):**
  - Thiếu khả năng lưu file trực tiếp vào máy (File System Access).
  - Ngôn ngữ giao diện chưa đồng nhất (lẫn lộn Anh/Việt).
  - Chưa có tính năng đồng bộ cuộn (Scroll Sync) giữa Editor và Preview.
- **Xử lý lỗi:** Logic `html2canvas` chụp ảnh biểu đồ Mermaid có thể không ổn định trên một số trình duyệt hoặc độ phân giải khác nhau.

## 2. Đề xuất Tính năng & Chức năng (Feature Roadmap)

Dưới đây là danh sách các tính năng được đề xuất, chia theo độ ưu tiên:

### A. Tính năng Cốt lõi (High Priority)

1.  **Lưu & Mở file từ máy tính (Local File System Support)**
    *   **Mô tả:** Sử dụng [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) để cho phép người dùng mở file `.md` từ máy tính và lưu trực tiếp (Ctrl+S) mà không cần tải file mới.
    *   **Lợi ích:** Trải nghiệm giống ứng dụng native (như VS Code/Notepad).

2.  **Đồng bộ Cuộn (Scroll Sync)**
    *   **Mô tả:** Khi người dùng cuộn bên khung Editor, khung Preview tự động cuộn đến vị trí tương ứng và ngược lại.
    *   **Lợi ích:** Giúp dễ dàng đối chiếu nội dung dài.

3.  **Việt hóa toàn bộ (Localization/i18n)**
    *   **Mô tả:** Chuyển đổi toàn bộ giao diện (Toolbar, Button, Modal) sang Tiếng Việt chuẩn. Có thể thêm tùy chọn chuyển đổi ngôn ngữ Anh/Việt.
    *   **Lợi ích:** Phù hợp với đối tượng người dùng mục tiêu.

### B. Tính năng Nâng cao (Medium Priority)

4.  **Hệ thống Mẫu (Templates)**
    *   **Mô tả:** Thư viện các mẫu Markdown dựng sẵn.
    *   **Ví dụ:** Biên bản cuộc họp, Báo cáo lỗi (Bug Report), Tài liệu kỹ thuật (SRS), Nhật ký công việc.

5.  **Thống kê (Statistics Bar)**
    *   **Mô tả:** Thanh trạng thái hiển thị số từ (Word count), số ký tự, thời gian đọc ước tính.

6.  **Focus Mode (Zen Mode)**
    *   **Mô tả:** Chế độ ẩn toàn bộ Toolbar, Header, Sidebar, chỉ hiển thị vùng soạn thảo để người dùng tập trung viết.

### C. Cải tiến Kỹ thuật (Technical Debt)

7.  **Refactor `App.tsx`**
    *   Tách `Toolbar` component.
    *   Tách `Editor` và `Preview` component.
    *   Sử dụng Custom Hooks (`useGoogleDocs`, `useTheme`, `useHotkeys`) để tách biệt logic khỏi UI.

8.  **Cải thiện Export PDF**
    *   Thay vì dùng `window.print()` mặc định, tích hợp thư viện tạo PDF chuyên dụng để có style đẹp hơn cho các báo cáo chuyên nghiệp.

## 3. Kết luận
Dự án Markiva có tiềm năng lớn để trở thành công cụ soạn thảo tài liệu mạnh mẽ. Việc ưu tiên Refactor code và thêm tính năng **Local File System** sẽ là bước đi quan trọng tiếp theo.
