#!/usr/bin/env node
// Launches the Playwright MCP server headless. In Claude Code cloud containers the
// browser download is blocked, so point it at the pre-installed Chromium instead,
// and run it without the sandbox since the container runs as root.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const cloudChromium = '/opt/pw-browsers/chromium'
const env = { ...process.env }
const cloudArgs = []
if (!env.PLAYWRIGHT_MCP_EXECUTABLE_PATH && existsSync(cloudChromium)) {
  env.PLAYWRIGHT_MCP_EXECUTABLE_PATH = cloudChromium
  cloudArgs.push('--no-sandbox')
}

const args = [
  '-y', '@playwright/mcp@0.0.83',
  '--headless',
  '--isolated',
  '--viewport-size', '1440x900',
  '--caps', 'vision',
  '--output-dir', '.playwright-mcp',
  ...cloudArgs,
  ...process.argv.slice(2),
]

const child = spawn('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)))
