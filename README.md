# -IT4788---172916-May-Day

# May Day

May Day là ứng dụng chăm sóc sức khỏe đa nền tảng. Hai frontend phục vụ các vai trò khác nhau và dùng chung API backend:

- [`mobile/`](mobile/README.md): React Native + Expo Router. Một codebase chạy iOS, Android và có thể mở trên trình duyệt bằng Expo Web; ưu tiên luồng bệnh nhân và thao tác di động của nhân viên.
- [`web/`](web/README.md): React + TypeScript + Vite. Cổng làm việc trên desktop cho nhân viên và quản trị viên.
- `backend/`: API dùng chung cho hai frontend.
- `Database/` và `Docs/`: cấu trúc dữ liệu, use case và hợp đồng OpenAPI.

## Chạy frontend

Chạy app đa nền tảng:

```bash
cd mobile
npm ci
npm start
```

Quét QR bằng Expo Go để mở app trên điện thoại. Nhấn `w` trong terminal Expo để mở **bản web của app Expo**.

Chạy cổng nhân viên/admin:

```bash
cd web
npm ci
npm run dev
```

Đây là web React riêng, thường mở tại `http://localhost:5173`; Vite chuyển tiếp `/api` đến backend `http://localhost:3000`.

Phạm vi frontend và danh sách luồng đã/ chưa được backend hỗ trợ được mô tả tại [`Docs/PHAM_VI_FRONTEND.md`](Docs/PHAM_VI_FRONTEND.md).

