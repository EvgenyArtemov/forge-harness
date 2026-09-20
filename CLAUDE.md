# Forge

A coding-agent harness built from scratch as a learning + portfolio project.
One UI-agnostic agent core, two renderers: React Ink CLI (first), Electron (later).
Full plan: `docs/roadmap.md` (milestones M0–M10).

## Layout
- `packages/agent-core` — agent loop, tools, model client. Headless.
- `apps/cli` — terminal frontend (plain readline in M0, React Ink from M1).
- `apps/desktop` — Electron (M7, not yet created).

## Ground rules
- `agent-core` never imports `react`, `ink`, or `electron`.
- From M1 on, `agent-core` never writes to stdout/console — it emits typed `AgentEvent`s.
- UI state is derived only by reducing events.
- Every async operation accepts an `AbortSignal` (from M4).

## Working with the owner
The owner is a senior frontend engineer learning Node.js/agent runtimes by building this.
- Code marked `TODO(x.y)` is an exercise for them. Don't implement it unless asked — review, hint, explain instead.
- Prefer explaining *why* (Node/OS/protocol behavior) over just handing over code.

## Commands
- `pnpm hello` — single model call, verifies the API key works
- `pnpm cli [--cwd <dir>]` — run the agent
- `pnpm typecheck`

## Secrets
`DEEPSEEK_API_KEY` lives in `.env` (gitignored, loaded with Node's `--env-file`). Never commit `.env`.
Model: `deepseek-v4-pro` via DeepSeek's Anthropic-compatible endpoint (`https://api.deepseek.com/anthropic`), using `@anthropic-ai/sdk`.
