# ChemDict

Từ điển thuật ngữ hóa học Anh–Việt. Toàn bộ thuật ngữ được hardcode, không dùng database.

## MCP servers (bắt buộc dùng trước khi viết code)

Repo cấu hình sẵn ba MCP server, tự cài và tự chạy khi mở phiên Claude Code:

- **codegraph** (`.mcp.json`): trước khi sửa hoặc thêm code, gọi `codegraph_explore` để tìm symbol, call path và phạm vi ảnh hưởng thay vì grep/đọc tràn lan. Subagent không có MCP thì dùng `codegraph explore "<query>"` qua Bash.
- **context-mode** (plugin, `.claude/settings.json`): dùng `ctx_batch_execute`, `ctx_execute`, `ctx_search`, `ctx_fetch_and_index` cho lệnh, đọc file, tra web có output lớn để giữ context gọn.
- **playwright** (`.mcp.json` → `.claude/mcp/playwright.mjs`): Chromium headless 1440×900, dùng `browser_snapshot` lấy `ref` trước khi click/type, `browser_take_screenshot` để tự kiểm tra UI. Trên cloud script tự trỏ tới Chromium có sẵn ở `/opt/pw-browsers` và chạy `--no-sandbox`. File output nằm ở `.playwright-mcp/` (đã gitignore).

Hook `.claude/hooks/session-start.sh` cài các CLI và plugin trên cloud, duyệt sẵn server trong `.mcp.json`, và chạy `codegraph init` nếu chưa có `.codegraph/`. Kiểm tra: `claude mcp list`, `/context-mode:ctx-doctor`, `codegraph status`.
