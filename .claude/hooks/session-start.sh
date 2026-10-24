#!/usr/bin/env bash
# Ensures the context-mode, codegraph and Playwright MCP servers are installed and
# the codegraph index exists, so all are ready before any code is written.
set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Cloud sessions start from a fresh container: install both CLIs globally.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  missing=()
  command -v context-mode >/dev/null 2>&1 || missing+=(context-mode)
  command -v codegraph >/dev/null 2>&1 || missing+=(@colbymchenry/codegraph)
  if [ ${#missing[@]} -gt 0 ]; then
    npm install -g "${missing[@]}" >&2 || echo "session-start: npm install failed for ${missing[*]}" >&2
  fi

  # Fallback in case the project-scoped plugin was not auto-installed at startup.
  if ! claude plugin list 2>/dev/null | grep -q 'context-mode@context-mode'; then
    claude plugin marketplace add mksglu/context-mode >&2
    claude plugin install context-mode@context-mode --scope project >&2 \
      || echo "session-start: context-mode plugin install failed" >&2
  fi

  # Pre-approve the project MCP servers so they never sit at "Pending approval".
  if [ ! -f .claude/settings.local.json ]; then
    printf '{\n  "enabledMcpjsonServers": ["codegraph", "playwright"]\n}\n' > .claude/settings.local.json
  fi

  # Warm the npx cache so the Playwright MCP server starts quickly.
  npx -y @playwright/mcp@0.0.83 --version >/dev/null 2>&1 || true
fi

if command -v codegraph >/dev/null 2>&1; then
  cg=(codegraph)
else
  cg=(npx -y @colbymchenry/codegraph)
fi

# Build the code graph once per checkout; the MCP server keeps it in sync after that.
if [ ! -d .codegraph ]; then
  "${cg[@]}" init --yes >&2 || echo "session-start: codegraph init failed" >&2
fi

exit 0
