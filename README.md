# ChemDict: Từ điển thuật ngữ Hóa học Anh – Việt

ChemDict là trang từ điển tra thuật ngữ hóa học bằng tiếng Anh hoặc tiếng Việt, có dấu hay không dấu đều được. Mỗi mục từ có:

- phiên âm và từ loại;
- định nghĩa song ngữ;
- hình minh họa, nếu bảng có;
- nguồn tham khảo của từng nghĩa.

Nguồn duy nhất là Google Sheet *"[Hóa ESL 11A10 + 11E2] Bảng từ vựng"* (các thẻ Bài 10–13). Dữ liệu được ghi cứng trong `shared/data/lexicon.json`, không dùng cơ sở dữ liệu.

Công nghệ: Nuxt 4 xuất trang tĩnh, Orama tìm kiếm ngay trên trình duyệt, GSAP cho chuyển động, và Three.js (WebGPU/TSL, tự lùi về WebGL2) cho đám mây electron benzene ở màn mở đầu.

## Chạy và build

Cần Node 20.19 trở lên (khuyên dùng 22, đã ghi trong `.nvmrc`).

```sh
npm install
npm run dev        # http://localhost:3000, chế độ phát triển
npm run build      # xuất trang tĩnh vào .output/public
npm run preview    # xem bản production tại http://localhost:3000
npm run typecheck
```

## Đưa lên mạng

Cả hai nơi đều chỉ phục vụ thư mục `.output/public`, nên không cần server.

### Vercel

1. Vào vercel.com, chọn **Add New → Project** rồi chọn repo `ChemDict`.
2. Giữ nguyên các thiết lập. `vercel.json` đã khai báo lệnh build `npm run build`, thư mục xuất `.output/public`, cache cho `/_nuxt/*` và các header bảo mật.
3. Bấm **Deploy**.

### Cloudflare Pages (đang dùng: https://chemdict.pages.dev)

Mỗi lần push lên `main` hoặc `claude/project-thread-8o54e3`, workflow `.github/workflows/deploy.yml` tự build và deploy lên project Pages `chemdict`. Repo cần hai secret trong **Settings → Secrets and variables → Actions**: `CLOUDFLARE_API_TOKEN` (token có quyền **Cloudflare Pages: Edit**) và `CLOUDFLARE_ACCOUNT_ID`. Có thể chạy lại tay ở tab **Actions → Deploy to Cloudflare Pages → Run workflow**.

Cách khác, nếu tạo project mới bằng Git của Cloudflare:

1. Vào **Workers & Pages → Create → Pages → Connect to Git** rồi chọn repo `ChemDict`.
2. Framework preset: **None**. Build command: `npm run build`. Build output directory: `.output/public`.
3. Nếu bản build chọn sai phiên bản Node, thêm biến môi trường `NODE_VERSION = 22`.
4. File `public/_headers` đặt cache và header bảo mật; trang `404.html` được dùng tự động.

Nếu nhánh chính của repo chưa có code, hãy chọn nhánh `claude/project-thread-8o54e3` làm nhánh production, hoặc gộp nhánh đó vào `main` trước.

## Cập nhật từ vựng (ví dụ thêm từ ở thẻ "Bài 13")

1. Mở Google Sheet, chọn **Tệp → Tải xuống → Microsoft Excel (.xlsx)**.
2. Chạy lệnh nhập. Lệnh này cần Python 3 với `openpyxl` và `Pillow`:

   ```sh
   pip install openpyxl pillow
   python3 scripts/import_sheet.py ~/Downloads/bang-tu-vung.xlsx
   ```

   Script ghi lại `shared/data/lexicon.json` và các ảnh minh họa WebP trong `public/hinh/`. Nó đọc mọi thẻ "Bài N" và giữ nguyên văn thuật ngữ, phiên âm, định nghĩa và nguồn.
3. Chạy `npm run build` để kiểm tra, rồi commit và push. Các trang `/tu/...` và `/bai/...` mới được tạo tự động.

## Kiểm tra chất lượng

Hai script kiểm tra dùng Playwright và chạy trên bản production:

```sh
npm run build && npx serve .output/public -l 4173
node scripts/motionqa.mjs http://localhost:4173   # 41 tiêu chí: fps ở DPR 2, Web Vitals, tương phản, bàn phím, không JS, vùng chạm
node scripts/shoot.mjs http://localhost:4173      # chụp 390 / 768 / 1440; thêm SCHEMES=light,dark, REDUCED=1 hoặc NOJS=1
```

## Tài liệu

- `COMMIT-SHEET.md`: định hướng thiết kế, token màu, chữ và chuyển động, cảnh 3D, và kết quả rà soát 18 lỗi "slop".
- `CINEMA-QA.md`: bảng kiểm tra production cùng số đo, kèm những gì môi trường cloud không kiểm chứng được.
