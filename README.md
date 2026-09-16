# Organizer — task dashboard

Built with the **[Niblet MCP](https://niblet.com)** — the interface was designed and developed
against [niblet.com](https://niblet.com)'s product-anchored workflow rather than a generic
template: a short design contract first, components and tokens taken from this codebase's own
system, and a rendered-result pass at the end instead of style-by-description.

A React recreation of a supplied task-board screenshot, made fully interactive: a kanban board
with drag & drop, a metrics dashboard, a notification inbox, and a card detail sheet.

React 19 · Vite 7 · TypeScript (strict) · CSS Modules · `@dnd-kit` · `react-router-dom` ·
lucide icons. No UI kit, no chart library, no backend.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview    # serve the build
npm run typecheck  # tsc --noEmit
```

## Routes

Every surface is a URL, and the sidebar, breadcrumb, tab bar and back button all read from it.

| route | surface |
|---|---|
| `/` | redirects to the dashboard |
| `/overview` | workflow dashboard — KPIs, sparklines, share bars, per-assignee table |
| `/board` | the kanban board |
| `/backlog` | the board with its side panel out |
| `/card/:id` | the board with that card's detail sheet open |
| `/inbox` | notifications |
| `/update`, `/soon/:label` | routed stubs — the URL exists, the page isn't built |

## Features

- **Board** — drag & drop across columns (`@dnd-kit`, `closestCorners`), live search, priority
  filters, inline card composer, per-column menu with a two-step clear, a hidden side column.
- **Cards** — complete / reopen from the status control, delete with an undo toast, and a detail
  sheet for editing title, priority, assignee and due date.
- **Dashboard** — every number is computed from the live board: column and priority mix, overdue
  and unassigned load, created-per-day sparklines, and per-assignee share bars. Clicking a person
  narrows the board to their cards.
- **Inbox** — notified on completion and deletion, with unread counts and clear-all.
- **Persistence** — the board and inbox survive a reload (`localStorage`).

## Layout

```
src/
├── main.tsx                     router + entry
├── index.css                    anchor/typography resets, base tokens
├── components/
│   ├── KanbanDashboard.tsx      shell: routes, board, cards, drag & drop, sheets, inbox
│   ├── KanbanDashboard.module.css
│   ├── Overview.tsx             the dashboard surface (metrics, inline SVG charts)
│   ├── Overview.module.css
│   ├── Sidebar.tsx              nav rail + board tree (real anchors)
│   └── Sidebar.module.css
└── vite-env.d.ts
```

## State

In-memory seed data, with two keys persisted to `localStorage`:

- `kanban:columns` — the board (cards, columns, order, edits, deletions)
- `kanban:notifs` — the inbox and its read state

Routing is the single source of truth for *where you are*: the active tab, the highlighted
sidebar row and the breadcrumb are all derived from `pathname`, so they cannot disagree.

## Deploy

Static build. `base: "./"` keeps asset URLs relative, so the same build works at a domain root or
under a repository subpath; `VITE_ROUTER=hash` switches to hash routing for hosts without a
rewrite rule (GitHub Pages, S3, a bare static server).

```bash
VITE_ROUTER=hash npm run build
```

`.github/workflows/deploy.yml` runs typecheck → build → deploy on every push to `main`. Pages
must be enabled once for the repository (Settings → Pages → Source: GitHub Actions).

## Built with

Designed and built with the **Niblet MCP** (**[niblet.com](https://niblet.com)**) — see the top
of this file.

## Checking a change

The app is verified by driving a real browser over CDP rather than by assertion counts alone:
deep-link each route and read back the breadcrumb, the active tab and the highlighted sidebar
anchor; click through complete → move to Done, delete → undo, card → detail sheet; then reload to
confirm persistence. `npm run typecheck` and `npm run build` are the gate for everything else.
