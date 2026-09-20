---
title: Agent Harness Roadmap
created: 2026-09-18
status: planning
tags:
  - agent-harness
  - nodejs
  - electron
  - ink
  - career
---

# Agent Harness Roadmap — "Forge"

> [!abstract] Thesis
> One **UI-agnostic agent core** that emits a typed event stream, consumed by **two renderers**: a React Ink CLI and an Electron desktop app. Same reducer, same protocol, different primitives.
>
> The deliverable is not "an AI app". It is proof you can model a **nondeterministic, long-running, partially-failing distributed process** and present it to a human.

```text
                 ┌──────────────────────────────┐
                 │        agent-core            │
                 │  loop · tools · permissions  │
                 │  (no console, no React)      │
                 └──────────────┬───────────────┘
                                │  AgentEvent[]
                        ┌───────┴────────┐
                        │  UI reducer    │  (shared, pure, unit-tested)
                        └───────┬────────┘
                    ┌───────────┴───────────┐
                    ▼                       ▼
              Ink CLI                  Electron
              <Box>                    <div>
```

---

## Ground rules (violate these and M7 becomes a rewrite)

- [ ] `agent-core` imports **zero** of: `react`, `ink`, `electron`
- [ ] `agent-core` never touches `process.stdout` / `console.*` — it emits events
- [ ] The event union is **append-only and versioned** from day one
- [ ] UI state is derived **only** by replaying events through the reducer — never mutated directly
- [ ] Every async operation accepts an `AbortSignal`

> [!tip] Why this matters
> If these hold, Electron (M7) is ~2 weeks. If they leak, it's a rewrite. This is the single highest-leverage decision in the project.

---

# M0 — Vertical Slice

**Goal:** a working agent in ~250 lines. Deliberately bad. You will replace most of it.
**Time:** 2 days

### 0.1 Repo scaffold
Monorepo: `packages/agent-core`, `apps/cli`. TypeScript strict, `tsx` for dev runs.
Required files: `.env`, `.env.example`, `.gitignore` (must contain `.env`, `node_modules/`, `dist/`), `CLAUDE.md`.

**Theme:** monorepo topology, workspace protocol, why packages beat folders
**Stack:** `pnpm workspaces`, `typescript`, `tsx`, `.gitignore`

### 0.2 First model call
One `messages.create` call. Print the text. Nothing else.

**Theme:** the Messages API shape — `system`, `messages[]`, roles, `stop_reason`
**Stack:** `@anthropic-ai/sdk`, `dotenv`

### 0.3 Three tools, declared
`read_file`, `write_file`, `bash`. Write their JSON Schemas by hand. Use `execSync` for bash — knowingly wrong, you'll feel why in M2.

**Theme:** tool/function calling, JSON Schema as the model's type system, description-as-prompt
**Stack:** JSON Schema, `node:fs/promises`, `node:child_process`

### 0.4 The loop
```ts
while (true) {
  const res = await model(messages);
  if (res.stop_reason !== "tool_use") break;
  const results = await executeTools(res.content);
  messages.push(assistant(res), user(results));
}
```
Type it yourself. Do not copy it.

**Theme:** the agent loop; why it's a `while`, not a framework; `tool_use` → `tool_result` pairing
**Stack:** plain TS

### 0.5 Workspace + system prompt
Every tool resolves paths relative to one workspace root. Draft a system prompt describing the environment.

**Theme:** context engineering, grounding the model in its environment
**Stack:** `node:path` (`resolve`, `relative`)

### 0.6 Acceptance test
Ask: *"What's in this repo, and do the tests pass?"* It must discover the answer by itself.

**Theme:** manual eval, defining "done" behaviorally
**Stack:** —

---

# M1 — Event Protocol + Ink Shell

**Goal:** the architectural hinge. Core goes silent; UI becomes an event consumer.
**Time:** 1 week

> [!warning] The forcing function
> Ink owns stdout — you literally cannot `console.log` into it. That's why Ink pulls the event protocol to the front of the project instead of month three.

### 1.1 Design `AgentEvent`
Discriminated union: `run.started`, `assistant.delta`, `tool.started`, `tool.output`, `tool.completed`, `tool.failed`, `run.completed`, `run.failed`. Every event carries `runId`, `seq`, `ts`.

**Theme:** discriminated unions, protocol design, monotonic sequence numbers
**Stack:** TypeScript unions, `zod` (optional, for runtime validation)

### 1.2 Core emits, never prints
Convert the loop to an `AsyncGenerator<AgentEvent>` (or `EventEmitter`). Delete every `console.log` in core.

**Theme:** async iterators, `for await...of`, push vs pull streams, backpressure semantics
**Stack:** `AsyncGenerator`, `node:events`

### 1.3 The reducer
`(state, event) => state`. Pure. Lives in `packages/ui-state`. Unit-tested with no UI at all.

**Theme:** event sourcing, projections, reducer purity — your Redux experience maps 1:1
**Stack:** `vitest`, plain TS

### 1.4 Ink app skeleton
`render(<App/>)`, `useReducer` fed by the event stream.

**Theme:** Ink is React — reconciler, Yoga flexbox layout in a terminal
**Stack:** `ink`, `react`, `<Box>`, `<Text>`

### 1.5 `<Static>` vs dynamic
Completed turns go into `<Static>` (rendered once, never redrawn). Only the in-flight turn lives in the dynamic region.

**Theme:** terminal rendering model, scrollback, ANSI cursor control, why Ink can't "scroll"
**Stack:** `<Static>`, `ink`

### 1.6 Streaming text
Render `assistant.delta` chunks as they arrive.

**Theme:** SSE, incremental rendering, perceived latency
**Stack:** `stream: true` in the SDK, `<Text>`

### 1.7 Input
Prompt box, submit, history with arrow keys.

**Theme:** raw mode, keypress handling, controlled inputs in a TUI
**Stack:** `useInput`, `ink-text-input`

---

# M2 — Real Execution

**Goal:** the bash tool becomes real. This is the most interesting frontend problem in the project.
**Time:** 1 week

### 2.1 `exec` → `spawn`
Non-buffering, streaming, with `cwd` and `env`.

**Theme:** `spawn` vs `exec` vs `fork` vs `execFile`; shell vs no-shell and the injection surface
**Stack:** `node:child_process`

### 2.2 Stream stdout/stderr as events
Each chunk becomes a `tool.output` event. Keep the two streams distinguishable.

**Theme:** Readable streams, chunk boundaries (a chunk is **not** a line), encoding
**Stack:** `readline.createInterface`, `stream` events

### 2.3 Ring buffer + truncation
Keep last N KB for display. Decide separately what goes back to the model (head + tail + "… 4021 lines elided").

**Theme:** bounded buffers, backpressure, **context budget** — a 50k-line log will destroy your context window
**Stack:** custom ring buffer, token counting

### 2.4 Throttle renders
Batch state updates to ~30ms. Naive per-chunk re-render melts the terminal.

**Theme:** render batching, coalescing, frame budgets — the terminal equivalent of list virtualization
**Stack:** `setInterval` batching / custom scheduler

### 2.5 Exit semantics
Exit code, signal, stderr-but-success, command-not-found.

**Theme:** POSIX exit codes, `ENOENT` vs non-zero exit, error surfaces
**Stack:** `close` vs `exit` events

### 2.6 Live output pane
Ink component showing the tail of a running command.

**Theme:** TUI layout under a fixed height, overflow handling
**Stack:** `<Box height>`, Yoga

---

# M3 — Process Lifecycle & Timeouts

**Goal:** nothing your agent starts ever outlives it.
**Time:** 1 week

### 3.1 Per-tool timeout
Configurable, default ~2 min. Emits `tool.failed` with a timeout reason.

**Theme:** deadlines vs timeouts, timer leaks, `unref()`
**Stack:** `AbortSignal.timeout`, `setTimeout`

### 3.2 Graceful kill escalation
SIGTERM → wait 5s → SIGKILL.

**Theme:** POSIX signals, which are catchable, why SIGKILL is last
**Stack:** `child.kill()`, `signal` codes

### 3.3 Process groups
`npm test` spawns children. Killing the parent orphans them. Spawn `detached: true`, kill `-pid`.

**Theme:** process groups, sessions, PPID, orphans and zombies, `ps -o pgid`
**Stack:** `detached`, `process.kill(-pid)`

### 3.4 Shutdown hooks
On app exit, kill the whole tree.

**Theme:** signal handling in the parent, cleanup ordering, `beforeExit` vs `exit`
**Stack:** `process.on('SIGINT')`, `exitHook`

### 3.5 Prove it
Run `sleep 300`, cancel, verify with `ps` that nothing survives.

**Theme:** verification over assumption
**Stack:** `ps`, `pgrep`

---

# M4 — Cancellation

**Goal:** Esc stops everything, cleanly, at any point.
**Time:** 1 week

### 4.1 `AbortSignal` end-to-end
Threaded from the session through the loop through every tool.

**Theme:** cooperative cancellation, signal propagation, `AbortController` composition
**Stack:** `AbortController`, `AbortSignal.any`

### 4.2 Abort the in-flight model request
Mid-stream HTTP abort.

**Theme:** `fetch` cancellation, partial responses, what to keep
**Stack:** SDK `{ signal }` option

### 4.3 Esc in Ink
Without breaking the submit flow.

**Theme:** input focus modes, key routing in a TUI
**Stack:** `useInput`

### 4.4 Consistent state after cancel
Every `tool_use` **must** get a matching `tool_result`, even a synthetic "cancelled" one, or the next API call 400s.

**Theme:** protocol invariants, partial failure, transactional thinking
**Stack:** Messages API constraints

### 4.5 Resume after cancel
The session stays alive; user types again.

**Theme:** session state machine — `idle | running | awaiting_approval | cancelling`
**Stack:** explicit state machine (or `xstate` if you want the rabbit hole)

---

# M5 — Permission Engine

**Goal:** the differentiator. A run that **suspends** on a human and resumes.
**Time:** 1–2 weeks

### 5.1 Policy model
Rules → `allow | ask | deny`. Matched per tool, per argument pattern.

**Theme:** policy engines, rule specificity, first-match vs most-specific
**Stack:** glob/regex matching, `minimatch`

### 5.2 Command classification
`npm test` ≠ `rm -rf /`. Parse enough of the command to classify risk.

**Theme:** why shell parsing is genuinely hard; parse trees; deny-list futility
**Stack:** `shell-quote` / custom tokenizer

### 5.3 Path jail
No reads or writes outside the workspace. Handle `..`, symlinks, absolute paths.

**Theme:** path traversal, `realpath`, TOCTOU races
**Stack:** `fs.realpath`, `path.relative`

### 5.4 Suspend/resume over the event stream
`approval.requested` goes out; the loop awaits a promise; the UI resolves it. One-way stream + correlated response channel.

**Theme:** request/response over an async stream, correlation IDs, deferred promises
**Stack:** promise registry keyed by `approvalId`

### 5.5 Approval UI in Ink
Show the exact command, the risk, `[Allow] [Allow always] [Deny]`.

**Theme:** consent UX, decision fatigue (real agents see ~93% blanket approval — design against that)
**Stack:** `ink-select-input`

### 5.6 Session-scoped grants
"Allow always" persists for the session, not forever.

**Theme:** scope of trust, principle of least privilege
**Stack:** in-memory policy overlay

---

# M6 — Sessions & Persistence

**Goal:** close the app, reopen, continue.
**Time:** 1–2 weeks

### 6.1 Event log is the source of truth
Persist events, derive everything else.

**Theme:** event sourcing, append-only logs, projections vs snapshots
**Stack:** SQLite, `better-sqlite3`

### 6.2 Schema
`sessions`, `runs`, `events`, `approvals`. Indexed by `(sessionId, seq)`.

**Theme:** schema design, indices, write-ahead logging
**Stack:** SQLite WAL mode, migrations

### 6.3 Resume
Replay events → reducer → rebuilt UI state. No special-case code.

**Theme:** determinism, replayability
**Stack:** the reducer from 1.3

### 6.4 Context compaction
The transcript will exceed the context window. Summarize old turns; keep tool results lean.

**Theme:** context window management, compaction strategies, prompt caching
**Stack:** token counting, cache breakpoints

### 6.5 Session list UI
Switch, rename, delete.

**Theme:** master/detail in a TUI
**Stack:** `ink`

---

# M7 — Electron

**Goal:** same core, same reducer, different primitives. The payoff milestone.
**Time:** 2 weeks

> [!note] Success criterion
> If M1 was done correctly, most of this is `<Box>` → `<div>` and moving the stream over IPC. If it's hard, that's a signal M1 leaked.

### 7.1 Scaffold
Electron + Vite + React + TS.

**Theme:** main vs renderer process model, bundling for two targets
**Stack:** `electron`, `electron-vite`, `react`

### 7.2 Core lives in main
The renderer never touches `fs` or `child_process`.

**Theme:** privilege separation, why the renderer is untrusted
**Stack:** Electron main process

### 7.3 Secure IPC bridge
`contextIsolation: true`, `nodeIntegration: false`, typed preload API.

**Theme:** Electron security checklist, context bridge, remote-code risk
**Stack:** `contextBridge`, `ipcMain`/`ipcRenderer`

### 7.4 Event transport
Stream `AgentEvent` over IPC; renderer feeds the **same** reducer.

**Theme:** serialization boundaries (structured clone), ordering guarantees, reconnection
**Stack:** `ipcRenderer.on`, shared `ui-state` package

### 7.5 Richer surfaces
Diff viewer, file tree, terminal pane, approval modal.

**Theme:** representing a nondeterministic process visually
**Stack:** `monaco-editor` or `diff2html`, `xterm.js`

### 7.6 Packaging
Build a real `.dmg`.

**Theme:** code signing, notarization, auto-update
**Stack:** `electron-builder`

---

# M8 — Observability / Run Debugger

**Goal:** the feature interviewers remember.
**Time:** 1–2 weeks

### 8.1 Trace model
Spans with parent/child: run → turn → tool call.

**Theme:** distributed tracing concepts, span/trace semantics, OpenTelemetry data model
**Stack:** custom spans (or `@opentelemetry/api`)

### 8.2 Token + cost accounting
Input, output, cache-read, cache-write per turn; running cost.

**Theme:** LLM cost modeling, prompt caching economics
**Stack:** `usage` from API responses

### 8.3 Run timeline UI
Waterfall of tool calls with durations.

**Theme:** waterfall/Gantt visualization, time-axis scaling
**Stack:** React, SVG

### 8.4 Replay
Re-run a stored event log through the UI at speed.

**Theme:** deterministic replay, debugging distributed systems
**Stack:** the event log from 6.1

---

# M9 — MCP

**Goal:** interoperability. Do this **after** the core is solid.
**Time:** 1–2 weeks

### 9.1 MCP client
Connect to an existing server over stdio.

**Theme:** MCP architecture — tools, resources, prompts; JSON-RPC framing
**Stack:** `@modelcontextprotocol/sdk`, stdio transport

### 9.2 Merge into the tool registry
MCP tools become indistinguishable from native ones — same permissions, same events.

**Theme:** adapter pattern, namespacing, tool-name collisions
**Stack:** your registry from M0

### 9.3 Build your own server
Something you actually know — e.g. motorcycle specs: `search_model`, `compare_models`.

**Theme:** server authoring, schema design, tool descriptions as prompts
**Stack:** MCP SDK server

### 9.4 Lifecycle
Servers crash. Handle reconnect, timeouts, capability negotiation.

**Theme:** fault tolerance across process boundaries
**Stack:** supervision/restart logic

---

# M10 — Sandboxing & Evals

**Goal:** the credibility layer.
**Time:** 3–4 weeks

### 10.1 Execution backend interface
`LocalBackend` and `DockerBackend` behind one interface.

**Theme:** strategy pattern, dependency inversion
**Stack:** TS interfaces

### 10.2 Docker execution
Mount workspace at `/workspace`, exec inside the container, stream output back.

**Theme:** containers, bind mounts, UID mapping, image layers
**Stack:** `dockerode`, Dockerfile

### 10.3 Isolation boundaries
Filesystem **and** network. Understand why both are required together.

**Theme:** threat modeling, exfiltration paths, defense in depth
**Stack:** Docker `--network`, seccomp, read-only mounts

### 10.4 Eval task format
20–30 tasks: fixture repo + prompt + assertion script.

**Theme:** eval design, ground truth, avoiding overfitting to your own tasks
**Stack:** JSON/YAML task specs, git fixtures

### 10.5 Eval runner
Headless, parallel, per-task isolated container.

**Theme:** test harness design, concurrency limits, flake handling
**Stack:** the headless core, `p-limit`

### 10.6 Metrics + regression tracking
Success rate, tool-call accuracy, turns, latency, tokens, cost, failure taxonomy. Store runs; compare over time.

**Theme:** regression testing for non-deterministic systems, statistical significance on small n
**Stack:** SQLite, a small results dashboard

---

# Portfolio Close-Out

### P.1 README
GIF first (10s: prompt → investigation → approval → fix → tests pass). Then architecture, security model, event protocol, eval results.

**Theme:** technical writing, leading with the demo
**Stack:** `vhs` or `asciinema` for terminal recording

### P.2 `docs/architecture.md`, `docs/security.md`, `docs/agent-loop.md`
The docs *are* the interview answers.

**Theme:** ADRs, design docs
**Stack:** Mermaid diagrams

### P.3 The measurable claim
> Before context optimization: 17/30 · After: 23/30

**Theme:** evidence over assertion
**Stack:** M10 output

---

## Do NOT spend time on

- ❌ LangChain / LangGraph — you're building the layer underneath
- ❌ Training, fine-tuning, ML math
- ❌ A large RAG system
- ❌ Making M1 "beautiful" — beautiful is an M5–M6 activity, once there's real content
- ❌ Multi-agent orchestration before single-agent is solid

---

## Realistic timeline

| Phase | Milestones | Cumulative |
|---|---|---|
| Foundations | M0–M2 | ~3 weeks |
| Runtime depth | M3–M4 | ~5 weeks |
| Product | M5–M6 | ~8 weeks |
| Desktop | M7 | ~10 weeks |
| Credibility | M8–M10 | ~16 weeks |

> [!important] Start applying at M7, not M10.
> A working CLI + desktop agent with permissions and sessions is already a stronger portfolio than 95% of candidates. M8–M10 can land while you're interviewing.

---

## Concept notes to create

[[Agent loop]] · [[Tool calling]] · [[child_process]] · [[Node streams]] · [[POSIX signals]] · [[Process groups]] · [[AbortController]] · [[Event sourcing]] · [[Discriminated unions]] · [[React Ink]] · [[Electron security model]] · [[IPC]] · [[Context window management]] · [[Prompt caching]] · [[MCP]] · [[Docker isolation]] · [[LLM evals]] · [[Distributed tracing]]
