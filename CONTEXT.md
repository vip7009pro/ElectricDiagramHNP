# CONTEXT — ElectroCAD Studio (ElectricDiagramHNP)

## Trạng thái hiện tại
- **Tech Stack:** React 19 + Vite + TypeScript + Tailwind CSS v4 + Lucide React + Zustand + Pure SVG + `html-to-image` + `jspdf`.
- **Trạng thái Build:** `npm run build` (`tsc -b && vite build`) thành công, không lỗi TypeScript.
- **Lưu trữ:** Tự động lưu thư viện linh kiện và dự án vào `localStorage` (`electrocad_templates_v1`, `electrocad_project_v1`), hỗ trợ Import/Export `.json`.

## Cấu trúc Source Code
- `src/types/diagram.ts` — Định nghĩa toàn bộ interfaces chuẩn (`Pin`, `ElementTemplate`, `CanvasElement`, `Wire`, `TitleBlockConfig`, `DiagramProjectFile`).
- `src/data/defaultTemplates.ts` — 3 mẫu linh kiện mặc định (Nguồn 24VDC 10A, Relay trung gian 8P, PLC FX5U-16MT), bảng màu dây tiêu chuẩn, và mạch demo khởi tạo.
- `src/utils/geometry.ts` — Toán học tọa độ: bắt dính lưới (`snapValue`), tính tọa độ chân thực sau khi xoay 0/90/180/270° (`getPinWorldPosition`), định tuyến dự phòng (`computeOrthogonalPoints`), tính bounding box (`getDiagramBounds`).
- `src/utils/routing.ts` — Thuật toán định tuyến vuông góc **A* tránh vật cản (Obstacle Avoidance)** & tách làn dây (`routeAllWires`): tự động vòng quanh thân các khối linh kiện (có vùng đệm `14px`) và tách song song các dây trên lưới `10px` để không chồng đè lên nhau.
- `src/utils/exportUtils.ts` — Xuất ảnh PNG độ phân giải 2x/3x (ẩn lưới/khung chọn, nền trắng) và xuất PDF khổ A4/A3 (ngang/dọc, fit-to-page) kèm Khung tên bản vẽ (Title Block) hỗ trợ tiếng Việt đầy đủ.
- `src/store/useDiagramStore.ts` — Zustand store quản lý state, lịch sử Undo/Redo (tối đa 50 bước), CRUD linh kiện/dây/mẫu, đi dây, viewport, và `localStorage`.
- `src/components/TopToolbar.tsx` — Thanh công cụ trên cùng (Undo/Redo, Grid 10/20px, Snap, Zoom, Fit-to-View, thao tác nhanh, Import/Export JSON, PNG, PDF).
- `src/components/LibrarySidebar.tsx` — Thư viện linh kiện bên trái với mini-SVG preview, tìm kiếm, kéo thả vào bản vẽ, chọn màu dây mặc định.
- `src/components/Canvas/DiagramCanvas.tsx` — Không gian vẽ SVG tương tác (Pan Space+Kéo/Chuột giữa, Zoom cuộn chuột, kéo thả bắt lưới, phím tắt CAD).
- `src/components/Canvas/ElementNode.tsx` — Render khối linh kiện SVG, nhãn thiết bị, chân kết nối tương tác.
- `src/components/Canvas/WireLayer.tsx` — Render dây điện vuông góc 90°, nhãn dây, và preview dây trực tiếp khi nối.
- `src/components/PropertiesPanel.tsx` — Bảng thuộc tính bên phải cho Element, Wire, và Khung tên bản vẽ.
- `src/components/ElementBuilderModal.tsx` — Trình tạo/sửa linh kiện nhiều chân (thêm đơn lẻ, sinh hàng loạt `X0..X7`, kéo thả chân trực tiếp trên SVG preview).
- `src/components/ExportModal.tsx` — Hộp thoại xuất PNG (2x/3x) và PDF (A4/A3, ngang/dọc, Title Block).

## Thay đổi gần nhất (2026-11-23)
- Thêm tính năng **Nối dây vào dây khác (Wire-to-Wire T-Junction / Splice)** (`types/diagram.ts`, `useDiagramStore.ts`, `routing.ts`, `WireLayer.tsx`, `DiagramCanvas.tsx`, `PropertiesPanel.tsx`):
  - Khi đang đi dây, rê chuột lên dây khác sẽ hiện điểm bắt nối nhánh (Junction Dot preview); click để nối nhánh, tự kế thừa màu dây chính, hiển thị **chấm nối to (`r=5.2px` có viền trắng)** phân biệt rõ với dây đi chéo không nối.
  - Điểm nối nhánh tự động bám theo dây chính khi kéo chỉnh đoạn dây hoặc di chuyển linh kiện; xóa dây chính sẽ tự dọn các dây nhánh phụ thuộc.
- Thêm tính năng **Kéo chỉnh đoạn dây (Drag Wire Segments)** và **Đi dây từng đoạn (Step-by-step Waypoint Wiring)** trên Canvas.
- Sửa lỗi nhập số Rộng/Cao trong `ElementBuilderModal.tsx`, lỗi xuất PNG/PDF trắng, và bổ sung Copy/Paste, Multi-select, A* Obstacle-Avoidance Routing.
