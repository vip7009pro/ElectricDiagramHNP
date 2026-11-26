# ROADMAP — ElectroCAD Studio (ElectricDiagramHNP)

## Giai đoạn 1: Khởi tạo & Tính năng cốt lõi (Hoàn thành)
- [x] Khởi tạo dự án React + TypeScript + Vite + Tailwind CSS v4 + Zustand
- [x] Thiết kế cấu trúc dữ liệu chuẩn (`Pin`, `ElementTemplate`, `CanvasElement`, `Wire`)
- [x] Không gian vẽ SVG tương tác: Lưới 10px/20px, Snap-to-grid, Pan (Space/Chuột giữa), Zoom (cuộn chuột & nút +/-)
- [x] Thao tác linh kiện: Chọn, kéo thả mượt, xoay 0°/90°/180°/270°, nhân bản (`Ctrl+D`), xóa (`Delete`/`Backspace`), Undo/Redo (`Ctrl+Z`/`Ctrl+Y`)
- [x] Trình tạo linh kiện nhiều chân (Element Builder): cấu hình khung, sinh chân hàng loạt (`X0..X7`), kéo thả vị trí chân trên preview
- [x] Thư viện linh kiện bên trái kèm 3 mẫu sẵn (Nguồn 24VDC, Relay 8 chân, PLC 16 chân), hỗ trợ kéo thả, chỉnh sửa & nhân bản (Copy) để tạo mẫu tương tự
- [x] Kết nối chân & định tuyến vuông góc 90° (Orthogonal Routing), cập nhật động theo thời gian thực khi di chuyển linh kiện
- [x] Bảng thuộc tính bên phải (Properties Panel) cho Element, Wire (màu, độ dày, nét liền/đứt, nhãn dây) và Title Block
- [x] Lưu trữ `localStorage` + Import/Export file `.json`
- [x] Kết xuất bản vẽ: PNG 2x/3x (ẩn lưới & selection, nền trắng) và PDF A4/A3 (ngang/dọc, fit-to-page, Title Block tiếng Việt)

## Giai đoạn 2: Nâng cao trải nghiệm CAD
- [x] Chọn nhiều đối tượng cùng lúc (Marquee / Box Selection, `Shift+Click`, `Ctrl+A`) và di chuyển/xoay/nhân bản/xóa theo nhóm
- [x] Copy & Paste (`Ctrl+C` / `Ctrl+V`) đơn lẻ và nhiều linh kiện ngay trên Canvas (giữ nguyên dây nối nội bộ trong nhóm)
- [x] Tự động tránh vật cản (Obstacle Avoidance A* routing) & tách làn chống chồng dây cho dây điện
- [x] Kéo chỉnh tay các đoạn dây vuông góc (Drag Wire Segments) & Đi dây từng đoạn trên Canvas (Step-by-step Waypoint Wiring)
- [x] Chấm nối nhánh (Junction Dot / T-splice) khi nối dây vào giữa một dây khác
- [ ] Quản lý nhiều trang bản vẽ (Multi-sheet / Page Tabs) trong cùng một dự án và xuất PDF nhiều trang
- [ ] Bảng thống kê thiết bị (BOM — Bill of Materials) và danh sách dây (Wire List) xuất CSV/Excel
