/* Workflow Overview — the board's metrics surface.
 *
 * Everything here is computed from the live board: column counts, priority mix,
 * overdue and unassigned load, and per-assignee share. Sparklines are
 * created-per-day series over the selected window, anchored on the newest card
 * date in the data (this is a demo board, so "today" would otherwise be
 * meaningless to the seeded dates).
 *
 * Layout and visual language follow the ops-dashboard reference: a header with
 * range pills and a search, a row of KPI cards, a row of list cards, and a
 * table with share bars. Charts are inline SVG — no chart dependency.
 */
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Box,
  Check,
  Clock,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
  Zap,
} from "lucide-react";
import type { Card, ColumnId, ColumnMeta, Columns, Priority } from "./KanbanDashboard";
import styles from "./Overview.module.css";

type Window = "today" | "week" | "month" | "all";

const WINDOWS: { id: Window; label: string; days: number }[] = [
  { id: "today", label: "Today", days: 1 },
  { id: "week", label: "This week", days: 7 },
  { id: "month", label: "This month", days: 30 },
  { id: "all", label: "All time", days: 0 },
];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/* "Aug 9", "23 Aug" and "Today" are the shapes the board actually uses. */
function parseCreated(value: string, today: Date): number | null {
  const v = value.trim().toLowerCase();
  if (v === "today") return today.getTime();
  const m = /^([a-z]+)\s+(\d{1,2})$/.exec(v) || /^(\d{1,2})\s+([a-z]+)$/.exec(v);
  if (!m) return null;
  const month = MONTHS[m[1]] ?? MONTHS[m[2]];
  const day = Number(MONTHS[m[1]] !== undefined ? m[2] : m[1]);
  if (month === undefined || Number.isNaN(day)) return null;
  return new Date(today.getFullYear(), month, day).getTime();
}

const DAY = 86_400_000;

type Row = { card: Card; col: ColumnId; colTitle: string; tone: ColumnMeta["tone"]; at: number | null };

/* ── charts ─────────────────────────────────────────────────────────────── */

function Sparkline({ values, tone }: { values: number[]; tone: "blue" | "green" }) {
  const w = 132;
  const h = 38;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 12)] as const);

  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    line += ` C ${x0 + (x1 - x0) / 3} ${y0}, ${x0 + (2 * (x1 - x0)) / 3} ${y1}, ${x1} ${y1}`;
  }
  const id = `spark-${tone}`;
  const stroke = tone === "blue" ? "#3b82f6" : "#35ba00";

  return (
    <svg className={styles.spark} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Bar({ value, max, tone = "blue" }: { value: number; max: number; tone?: "blue" | "gray" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span className={styles.bar}>
      <span className={`${styles.barFill} ${tone === "gray" ? styles.barGray : ""}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

/* ── cards ──────────────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  unit,
  children,
  footer,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  children?: React.ReactNode;
  footer: [string, string][];
  icon: React.ReactNode;
}) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <span className={styles.cardLabel}>{label}</span>
        <span className={styles.iconButton}>{icon}</span>
      </header>
      <div className={styles.kpi}>
        <strong>{value}</strong>
        {unit && <span className={styles.kpiUnit}>{unit}</span>}
      </div>
      {children}
      <div className={styles.kpiFoot}>
        {footer.map(([k, v]) => (
          <span key={k} className={styles.kpiFootItem}>
            <em>{k}</em>
            <strong>{v}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}

function ListRow({
  icon,
  label,
  value,
  chip,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  chip?: { text: string; tone: "green" | "blue" | "amber" };
}) {
  return (
    <li className={styles.listRow}>
      <span className={styles.listIcon}>{icon}</span>
      <span className={styles.listLabel}>{label}</span>
      {chip && <span className={`${styles.chip} ${styles[`chip_${chip.tone}`]}`}>{chip.text}</span>}
      <span className={styles.listValue}>{value}</span>
    </li>
  );
}

/* ── the dashboard ──────────────────────────────────────────────────────── */

export default function Overview({
  columns,
  colMeta,
  onPerson,
}: {
  columns: Columns;
  colMeta: ColumnMeta[];
  /* clicking a person narrows the board to their cards */
  onPerson: (name: string) => void;
}) {
  const [win, setWin] = useState<Window>("month");
  const [query, setQuery] = useState("");

  const today = useMemo(() => new Date(), []);

  const all: Row[] = useMemo(
    () =>
      colMeta.flatMap((c) =>
        columns[c.id].map((card) => ({
          card,
          col: c.id,
          colTitle: c.title,
          tone: c.tone,
          at: parseCreated(card.created, today),
        })),
      ),
    [columns, colMeta, today],
  );

  /* The window is anchored on the newest card the board knows about, so the
     seeded dates produce a populated series instead of an empty one. */
  const anchor = useMemo(
    () => all.reduce((max, r) => (r.at && r.at > max ? r.at : max), 0) || today.getTime(),
    [all, today],
  );

  const config = WINDOWS.find((w) => w.id === win) ?? WINDOWS[2];
  const rows = useMemo(
    () => (config.days === 0 ? all : all.filter((r) => r.at != null && anchor - r.at < config.days * DAY)),
    [all, anchor, config.days],
  );

  const days = config.days === 0 ? 30 : config.days;
  /* One series builder, used for both the total and the done-only line, so
     every chart is a real tabulation of the cards in the window. */
  const seriesFor = (source: Row[]) => {
    const buckets = new Array(days).fill(0);
    source.forEach((r) => {
      if (r.at == null) return;
      const idx = days - 1 - Math.floor((anchor - r.at) / DAY);
      if (idx >= 0 && idx < days) buckets[idx] += 1;
    });
    return buckets;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const series = useMemo(() => seriesFor(rows), [rows, anchor, days]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doneSeries = useMemo(() => seriesFor(rows.filter((r) => r.col === "done")), [rows, anchor, days]);

  const stats = useMemo(() => {
    const byCol = Object.fromEntries(colMeta.map((c) => [c.id, 0])) as Record<ColumnId, number>;
    const byPri: Record<Priority, number> = { Urgent: 0, Normal: 0, Low: 0 };
    let overdue = 0;
    let unassigned = 0;
    let noDate = 0;
    const byPerson = new Map<string, number>();

    rows.forEach(({ card, col }) => {
      byCol[col] += 1;
      byPri[card.priority] += 1;
      if (card.overdue) overdue += 1;
      if (/unassigned/i.test(card.assignee)) unassigned += 1;
      if (!card.date) noDate += 1;
      const who = card.assignee.replace(/\s*\+\d+$/, "").trim() || "Unassigned";
      byPerson.set(who, (byPerson.get(who) ?? 0) + 1);
    });

    return {
      total: rows.length,
      byCol,
      byPri,
      overdue,
      unassigned,
      noDate,
      people: [...byPerson.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [rows, colMeta]);

  const doneShare = stats.total ? Math.round((stats.byCol.done / stats.total) * 100) : 0;
  const flightShare = stats.total ? Math.round((stats.byCol.inProgress / stats.total) * 100) : 0;
  const urgentShare = stats.total ? Math.round(((stats.byPri.Urgent + stats.overdue) / stats.total) * 100) : 0;
  const normalShare = stats.total ? Math.round((stats.byPri.Normal / stats.total) * 100) : 0;
  const wip = Math.max(stats.byCol.todo, stats.byCol.inProgress, stats.byCol.done);

  const busiest = colMeta.reduce((a, b) => (stats.byCol[b.id] > stats.byCol[a.id] ? b : a), colMeta[0]);
  const peaks = {
    series: Math.max(0, ...series),
    avg: series.length ? (rows.length / series.length).toFixed(1) : "0.0",
  };

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? stats.people.filter(([name]) => name.toLowerCase().includes(q)) : stats.people;
    return list.map(([name, count]) => [name, count, stats.total ? Math.round((count / stats.total) * 100) : 0] as const);
  }, [stats.people, stats.total, query]);

  return (
    <div className={styles.wrap} data-scroll-root>
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Board health and throughput</p>
          <h2 className={styles.title}>Workflow Overview</h2>
        </div>
        <div className={styles.headTools}>
          <div className={styles.pills} role="tablist" aria-label="Time window">
            {WINDOWS.map((w) => (
              <button
                key={w.id}
                role="tab"
                aria-selected={win === w.id}
                className={win === w.id ? styles.pillOn : styles.pill}
                onClick={() => setWin(w.id)}
              >
                {w.label}
              </button>
            ))}
          </div>
          <label className={styles.search}>
            <Search size={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
            />
          </label>
        </div>
      </header>

      <div className={styles.kpiGrid}>
        <KpiCard
          label="Cards"
          value={String(stats.total)}
          unit="in window"
          icon={<TrendingUp size={13} />}
          footer={[
            ["Peak / day", String(peaks.series)],
            ["Avg / day", peaks.avg],
          ]}
        >
          <Sparkline values={series} tone="blue" />
        </KpiCard>

        <KpiCard
          label="Completed"
          value={String(stats.byCol.done)}
          unit={`${doneShare}% of board`}
          icon={<Check size={13} />}
          footer={[
            ["In flight", String(stats.byCol.inProgress)],
            ["Waiting", String(stats.byCol.todo)],
          ]}
        >
          <Sparkline values={doneSeries} tone="green" />
        </KpiCard>

        <KpiCard
          label="In flight share"
          value={`${flightShare}%`}
          icon={<Layers size={13} />}
          footer={[
            ["WIP column", busiest.title],
            ["WIP cards", String(wip)],
          ]}
        >
          <Bar value={stats.byCol.inProgress} max={stats.total} />
          <p className={styles.note}>
            {stats.byCol.inProgress} of {stats.total} cards past the backlog
          </p>
        </KpiCard>

        <KpiCard
          label="Urgent load"
          value={`${urgentShare}%`}
          icon={<Zap size={13} />}
          footer={[
            ["Urgent", String(stats.byPri.Urgent)],
            ["Overdue", String(stats.overdue)],
          ]}
        >
          <Bar value={stats.byPri.Urgent + stats.overdue} max={stats.total} />
          <p className={styles.note}>
            {normalShare}% of the window is normal priority
          </p>
        </KpiCard>
      </div>

      <div className={styles.listGrid}>
        <section className={styles.card}>
          <header className={styles.cardHead}>
            <span className={styles.cardTitle}>Flow</span>
            <span className={styles.iconButton}>
              <Box size={13} />
            </span>
          </header>
          <ul className={styles.list}>
            {colMeta.map((c) => (
              <ListRow
                key={c.id}
                icon={<span className={`${styles.dot} ${styles[`dot_${c.tone}`]}`} />}
                label={c.title}
                value={stats.byCol[c.id]}
                chip={c.id === busiest.id && stats.byCol[c.id] > 0 ? { text: "busiest", tone: "green" } : undefined}
              />
            ))}
          </ul>
          <p className={styles.cardFoot}>
            {stats.byCol.done === stats.total && stats.total > 0
              ? "Everything in the window is done"
              : `${stats.byCol.done} done · ${stats.total - stats.byCol.done} open`}
          </p>
        </section>

        <section className={styles.card}>
          <header className={styles.cardHead}>
            <span className={styles.cardTitle}>Mix</span>
            <span className={styles.iconButton}>
              <Sparkles size={13} />
            </span>
          </header>
          <ul className={styles.list}>
            <ListRow icon={<Zap size={14} />} label="Urgent" value={stats.byPri.Urgent} />
            <ListRow icon={<Sparkles size={14} />} label="Normal" value={stats.byPri.Normal} />
            <ListRow icon={<Clock size={14} />} label="Low" value={stats.byPri.Low} />
            <ListRow icon={<UsersRound size={14} />} label="Unassigned" value={stats.unassigned} />
          </ul>
          <p className={styles.cardFoot}>{normalShare}% normal · {urgentShare}% urgent or overdue</p>
        </section>

        <section className={styles.card}>
          <header className={styles.cardHead}>
            <span className={styles.cardTitle}>Signals</span>
            <span className={styles.iconButton}>
              <ShieldCheck size={13} />
            </span>
          </header>
          <ul className={styles.list}>
            {(
              [
                ["Overdue", stats.overdue],
                ["Unassigned", stats.unassigned],
                ["No due date", stats.noDate],
              ] as [string, number][]
            ).map(([label, value]) => (
              <li key={label} className={styles.listRow}>
                <span
                  className={`${styles.signalIcon} ${
                    value === 0 ? styles.signalOk : styles.signalWarn
                  }`}
                >
                  {/* a tick means "nothing here" — only when that's true */}
                  {value === 0 ? <Check size={12} /> : <AlertTriangle size={12} />}
                </span>
                <span className={styles.listLabel}>{label}</span>
                <span className={styles.listValue}>{value}</span>
              </li>
            ))}
          </ul>
          <p className={styles.cardFoot}>
            {stats.overdue === 0
              ? "No overdue cards in this window"
              : `${stats.overdue} card${stats.overdue === 1 ? "" : "s"} past due`}
          </p>
        </section>
      </div>

      <section className={`${styles.card} ${styles.tableCard}`}>
        <header className={styles.cardHead}>
          <span className={styles.cardTitle}>
            <UsersRound size={15} /> Cards by assignee
          </span>
          <span className={styles.iconButton}>
            <ArrowUpRight size={13} />
          </span>
        </header>
        <div className={styles.table} role="table" aria-label="Cards by assignee">
          <div className={`${styles.tr} ${styles.trHead}`} role="row">
            <span role="columnheader">Person</span>
            <span role="columnheader">Cards</span>
            <span role="columnheader">Share</span>
          </div>
          {people.map(([name, count, share]) => (
            <button
              key={name}
              className={styles.tr}
              role="row"
              onClick={() => onPerson(name)}
              title={`Show ${name}'s cards on the board`}
            >
              <span role="cell" className={styles.personCell}>
                <span
                  className={styles.avatar}
                  style={{ background: `hsl(${(name.charCodeAt(0) * 37) % 360} 68% 58%)` }}
                >
                  {name.slice(0, 1).toUpperCase()}
                </span>
                {name}
              </span>
              <span role="cell" className={styles.numCell}>
                {count}
              </span>
              <span role="cell" className={styles.shareCell}>
                <span className={styles.shareNum}>{share}%</span>
                <Bar value={count} max={stats.total} tone={share === 0 ? "gray" : "blue"} />
              </span>
            </button>
          ))}
          {people.length === 0 && <p className={styles.empty}>No one matches “{query}”</p>}
        </div>
      </section>
    </div>
  );
}
