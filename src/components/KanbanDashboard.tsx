import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Ellipsis,
  Filter,
  GripVertical,
  Link2,
  PanelRight,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import Sidebar from "./Sidebar";
import Overview from "./Overview";
import styles from "./KanbanDashboard.module.css";

export type Priority = "Urgent" | "Normal" | "Low";
const PRIORITIES: Priority[] = ["Urgent", "Normal", "Low"];

export type Card = {
  id: string;
  title: string;
  created: string;
  team: string;
  priority: Priority;
  assignee: string;
  date?: string;
  overdue?: boolean;
  /* optional attachment thumbnail — opens in the image-open-tilt lightbox */
  cover?: string;
};

export type ColumnId = "todo" | "inProgress" | "done";
export type Columns = Record<ColumnId, Card[]>;
export type ColumnMeta = { id: ColumnId; title: string; tone: "gray" | "blue" | "green" };
type TabKey = "overview" | "update" | "issues";

/* Sidebar board tree: which board surface is in front. */
export type SidebarView = "board" | "backlog" | "reports" | "overview";

/* ── routes ──────────────────────────────────────────────────────────────────
   Every surface is a URL, so the sidebar, the breadcrumb, the tab bar and the
   back button all describe the same place.

     /overview        the dashboard
     /board           the kanban board
     /backlog         the board with its side panel out
     /card/:id        the board with that card's sheet open
     /update          update surface (not built yet)
     /inbox           notifications
     /soon/:label     a surface that isn't built yet
*/
type RouteKey = "overview" | "board" | "backlog" | "update" | "inbox" | "soon";

function parseRoute(pathname: string): {
  key: RouteKey;
  cardId: string | null;
  label: string | null;
} {
  const seg = pathname.split("/").filter(Boolean);
  const head = seg[0] ?? "";
  if (head === "card" && seg[1]) return { key: "board", cardId: seg[1], label: null };
  if (head === "board") return { key: "board", cardId: null, label: null };
  if (head === "backlog") return { key: "backlog", cardId: null, label: null };
  if (head === "update") return { key: "update", cardId: null, label: null };
  if (head === "inbox") return { key: "inbox", cardId: null, label: null };
  if (head === "soon")
    return { key: "soon", cardId: null, label: decodeURIComponent(seg[1] ?? "Surface") };
  return { key: "overview", cardId: null, label: null };
}

/* The board itself: the middle crumb, and the document the topbar acts on. */
const BOARD_NAME = "Task Progress";

type Notif = { id: string; text: string; at: string; read: boolean };

const INITIAL_NOTIFS: Notif[] = [
  { id: "n1", text: "Andrew moved “Validate campaign tracking” to In progress", at: "12m", read: false },
  { id: "n2", text: "Mark commented on “Prepare Q2 product roadmap”", at: "1h", read: false },
  { id: "n3", text: "Jimmy completed “Update design system components”", at: "3h", read: true },
];

/* `--modal-close-dur` from the modal-open-close recipe — the phase swap has to
   outlast it or the card vanishes mid-transition. */
const MODAL_CLOSE_MS = 150;

/* Board state survives a reload; a broken/absent entry falls back silently. */
function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const COLUMNS: ColumnMeta[] = [
  { id: "todo", title: "To do", tone: "gray" },
  { id: "inProgress", title: "In progress", tone: "blue" },
  { id: "done", title: "Done", tone: "green" },
];

const TABS: { id: TabKey; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "update", label: "Update" },
  { id: "issues", label: "Issues" },
];

const todo: Card[] = [
  {
    id: "t1",
    title: "Prepare Q2 product roadmap",
    created: "Aug 9",
    team: "3 Musketeer",
    priority: "Urgent",
    assignee: "Mark +1",
    date: "Sept 6",
  },
  {
    id: "t2",
    title: "Update design system components",
    created: "Aug 8",
    team: "1 Musketeer",
    priority: "Normal",
    assignee: "Andrew",
    date: "Aug 25",
  },
];

const inProgress: Card[] = [
  {
    id: "p1",
    title: "Create alignment summary document",
    created: "Aug 9",
    team: "3 Musketeer",
    priority: "Urgent",
    assignee: "Andrew +2",
    overdue: true,
  },
  {
    id: "p2",
    title: "Review homepage copy for launch",
    created: "Aug 9",
    team: "3 Musketeer",
    priority: "Low",
    assignee: "Andrew +2",
    overdue: true,
  },
  {
    id: "p3",
    title: "Validate campaign tracking",
    created: "Jul 20",
    team: "3 Musketeer",
    priority: "Normal",
    assignee: "Jimmy",
    date: "23 Aug",
  },
  {
    id: "p4",
    title: "Configure analytics dashboard",
    created: "Jul 20",
    team: "3 Musketeer",
    priority: "Normal",
    assignee: "Mark",
    date: "Aug 25",
  },
  {
    id: "p5",
    title: "Define success metrics (KPIs)",
    created: "Jul 22",
    team: "3 Musketeer",
    priority: "Urgent",
    assignee: "Andrew +2",
    overdue: true,
  },
];

const done: Card[] = [
  {
    id: "d1",
    title: "Create alignment summary document",
    created: "Aug 9",
    team: "3 Musketeer",
    priority: "Normal",
    assignee: "Andrew",
    date: "Today",
  },
  {
    id: "d2",
    title: "Create alignment summary document",
    created: "Aug 9",
    team: "3 Musketeer",
    priority: "Normal",
    assignee: "Mark +2",
    overdue: true,
  },
  {
    id: "d3",
    title: "Create alignment summary document",
    created: "Aug 9",
    team: "3 Musketeer",
    priority: "Normal",
    assignee: "Andrew +2",
    date: "Today",
  },
];

const initialColumns: Columns = { todo, inProgress, done };

/* -- helpers ------------------------------------------------------------ */

/** Open/closing/closed machine for menu-dropdown + toast-open-close patterns. */
function PriorityPill({ priority }: { priority: Priority }) {
  return (
    <span className={`${styles.pill} ${styles[`priority${priority}`]}`}>
      <span className={styles.priorityBars} aria-hidden>
        <i />
        <i />
        <i />
      </span>
      {priority}
    </span>
  );
}

function PersonPill({ children }: { children: React.ReactNode }) {
  return (
    <span className={styles.pill}>
      <UsersRound size={13} strokeWidth={1.8} />
      {children}
    </span>
  );
}

function DatePill({ value }: { value: string }) {
  return (
    <span className={styles.pill}>
      <CalendarDays size={13} strokeWidth={1.8} />
      {value}
    </span>
  );
}

function TaskCard({
  card,
  floating = false,
  done = false,
  onComplete,
  onDelete,
  onOpen,
}: {
  card: Card;
  floating?: boolean;
  done?: boolean;
  onComplete?: (el: HTMLElement) => void;
  onDelete?: (el: HTMLElement) => void;
  onOpen?: () => void;
}) {

  return (
    <article
      className={`${styles.card} ${floating ? styles.floatingCard : ""}`}
      onClick={
        onOpen
          ? (e) => {
              e.stopPropagation();
              onOpen();
            }
          : undefined
      }
    >
      <div className={styles.cardTitleRow}>
        <GripVertical size={13} className={styles.grip} />
        {/* the status control doubles as complete / reopen */}
        {onComplete ? (
          <button
            type="button"
            className={`${styles.statusToggle} ${done ? styles.statusDone : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onComplete(e.currentTarget);
            }}
            aria-pressed={done}
            aria-label={done ? `Reopen ${card.title}` : `Mark ${card.title} complete`}
            title={done ? "Reopen card" : "Mark complete"}
          >
            {done && <Check size={10} strokeWidth={3} />}
          </button>
        ) : (
          <span className={styles.stateDot} />
        )}
        <h3>{card.title}</h3>
        {onDelete && (
          <button
            className={styles.cardDelete}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e.currentTarget);
            }}
            aria-label={`Delete ${card.title}`}
            title="Delete card"
          >
            <X size={13} strokeWidth={1.8} />
          </button>
        )}
      </div>
      <div className={styles.meta}>
        Created {card.created}
        <span>•</span>
        {card.team}
      </div>
      <div className={styles.divider} />
      <div className={styles.cardFooter}>
        <PriorityPill priority={card.priority} />
        <PersonPill>{card.assignee}</PersonPill>
        {card.overdue ? (
          <span className={`${styles.pill} ${styles.overdue}`}>Overdue</span>
        ) : card.date ? (
          <DatePill value={card.date} />
        ) : null}
      </div>
    </article>
  );
}

/* The card detail sheet: one open/closing phase, held here so the sheet can
   animate out before it unmounts. */
function CardDetail({
  card,
  phase,
  onClose,
  onSave,
  onDelete,
}: {
  card: Card;
  phase: "open" | "closing";
  onClose: () => void;
  onSave: (patch: Partial<Card>) => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState(card);

  useEffect(() => setDraft(card), [card.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={`${styles.detailScrim} ${phase === "closing" ? styles.detailScrimClosing : ""}`}>
      <button className={styles.detailScrimButton} onClick={onClose} aria-label="Close card" />
      <div
        className={`${styles.detailSheet} ${phase === "open" ? styles.sheetOpen : styles.sheetClosing}`}
        role="dialog"
        aria-modal="true"
        aria-label={card.title}
      >
        <header className={styles.detailHead}>
          <span className={styles.detailKey}>{draft.id.slice(0, 6).toUpperCase()}</span>
          <button className={styles.detailClose} onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </header>

        <input
          className={styles.detailTitle}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          aria-label="Card title"
        />

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Priority</span>
          <div className={styles.detailChips}>
            {(["Urgent", "Normal", "Low"] as Priority[]).map((p) => (
              <button
                key={p}
                className={`${styles.detailChip} ${draft.priority === p ? styles.detailChipOn : ""}`}
                onClick={() => setDraft({ ...draft, priority: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Assignee</span>
          <input
            className={styles.detailInput}
            value={draft.assignee}
            onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
            aria-label="Assignee"
          />
        </div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Due</span>
          <input
            className={styles.detailInput}
            value={draft.date ?? ""}
            placeholder="Sept 6"
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            aria-label="Due date"
          />
        </div>

        <footer className={styles.detailFoot}>
          <button className={styles.detailDelete} onClick={onDelete}>
            <Trash2 size={13} /> Delete
          </button>
          <div className={styles.detailFootRight}>
            <button className={styles.detailCancel} onClick={onClose}>
              Cancel
            </button>
            <button
              className={styles.detailSave}
              onClick={() => {
                onSave({
                  title: draft.title.trim() || card.title,
                  priority: draft.priority,
                  assignee: draft.assignee,
                  date: draft.date || undefined,
                });
                onClose();
              }}
            >
              Save
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function SortableTaskCard({
  card,
  locked,
  animate,
  done,
  onComplete,
  onDelete,
  onOpen,
}: {
  card: Card;
  locked: boolean;
  animate: boolean;
  done: boolean;
  onComplete: (el: HTMLElement) => void;
  onDelete: (el: HTMLElement) => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: locked });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-card-id={card.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={[
        styles.cardSlot,
        locked ? "" : styles.cardGrab,
        isDragging ? styles.cardDragging : "",
        animate && !isDragging ? styles.cardEnter : "",
      ].join(" ")}
    >
      <TaskCard
        card={card}
        done={done}
        onComplete={onComplete}
        onDelete={onDelete}
        onOpen={onOpen}
      />
    </div>
  );
}

function DropZone({
  columnId,
  children,
}: {
  columnId: ColumnId;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  return (
    <div
      ref={setNodeRef}
      className={`${styles.cards} ${isOver ? styles.dropOver : ""}`}
      data-scroll-root
    >
      {children}
    </div>
  );
}

function ColumnHeader({
  title,
  tone,
  onAdd,
  onMenu,
  menuActive,
}: {
  title: string;
  tone: "gray" | "blue" | "green";
  onAdd: () => void;
  onMenu: () => void;
  menuActive: boolean;
}) {
  return (
    <div className={styles.columnHeader}>
      <div className={styles.columnTitle}>
        <span className={`${styles.columnIcon} ${styles[`tone${tone}`]}`} />
        <strong>{title}</strong>
      </div>
      <div className={styles.columnActions}>
        <button className={styles.columnAction} onClick={onAdd} aria-label={`Add card to ${title}`}>
          <Plus size={14} />
        </button>
        <button
          className={`${styles.columnAction} ${menuActive ? styles.columnActionActive : ""}`}
          onClick={onMenu}
          aria-label={`${title} options`}
        >
          <Ellipsis size={15} />
        </button>
      </div>
    </div>
  );
}

export default function KanbanDashboard() {
  const [columns, setColumns] = useState<Columns>(() => loadStored("kanban:columns", initialColumns));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | undefined>(undefined);

  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [prioritySel, setPrioritySel] = useState<Priority[]>([]);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const route = useMemo(() => parseRoute(pathname), [pathname]);
  const [collapsed, setCollapsed] = useState(false);
  const [hiddenOpen, setHiddenOpen] = useState(route.key === "backlog");

  /* Each surface owns the panel state it implies: Backlog is the board with the
     side panel out, Board is the board without it. */
  useEffect(() => {
    if (route.key === "backlog") setHiddenOpen(true);
    else if (route.key === "board") setHiddenOpen(false);
  }, [route.key]);

  /* The tab bar is a view of the route, not a second source of truth: /board and
     /backlog are the Issues tab, /overview and /update are themselves. */
  const tab: TabKey | "" =
    route.key === "overview"
      ? "overview"
      : route.key === "update"
        ? "update"
        : route.key === "board" || route.key === "backlog"
          ? "issues"
          : "";

  const selectSidebarView = (view: SidebarView) => {
    if (view === "board") navigate("/board");
    else if (view === "backlog") navigate("/backlog");
    else navigate("/overview");
  };

  const selectTab = (next: TabKey) => {
    if (next === "issues") navigate("/board");
    else navigate(`/${next}`);
  };

  const [composerFor, setComposerFor] = useState<ColumnId | null>(null);
  const [draft, setDraft] = useState("");
  const [menuFor, setMenuFor] = useState<ColumnId | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [columnOpen, setColumnOpen] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastData, setToastData] = useState<
    | { kind: "clear"; col: ColumnId; cards: Card[] }
    | { kind: "delete"; col: ColumnId; index: number; cards: Card[] }
    | null
  >(null);
  const toastTimer = useRef<number>(undefined);


  const [notifs, setNotifs] = useState<Notif[]>(() => loadStored("kanban:notifs", INITIAL_NOTIFS));
  const [notifOpen, setNotifOpen] = useState(false);
  const [detailPhase, setDetailPhase] = useState<"open" | "closing">("open");

  const unread = notifs.filter((n) => !n.read).length;

  const tabRefs = useRef(new Map<TabKey, HTMLButtonElement>());
  const tabRef = useRef<TabKey | "">(tab);
  tabRef.current = tab;

  const searchRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const q = query.trim().toLowerCase();
  const filterActive = prioritySel.length > 0;
  // Dragging while a view filter is applied would scramble order math — lock it.
  const dndLocked = q !== "" || (filterActive && prioritySel.length < PRIORITIES.length);

  const visible = useMemo(() => {
    const out = {} as Columns;
    for (const { id } of COLUMNS) {
      out[id] = columns[id].filter((c) => {
        const okQuery =
          !q || `${c.title} ${c.assignee} ${c.team} ${c.priority}`.toLowerCase().includes(q);
        const okPriority = !filterActive || prioritySel.includes(c.priority);
        return okQuery && okPriority;
      });
    }
    return out;
  }, [columns, q, filterActive, prioritySel]);

  const totalCards = COLUMNS.reduce((n, c) => n + columns[c.id].length, 0);
  const totalVisible = COLUMNS.reduce((n, c) => n + visible[c.id].length, 0);

  const findColumn = (id: string | number): ColumnId | undefined => {
    const key = String(id);
    if (key in columns) return key as ColumnId;
    return (Object.keys(columns) as ColumnId[]).find((col) =>
      columns[col].some((c) => c.id === key),
    );
  };

  const resetDrag = () => {
    setActiveId(null);
    setActiveCard(null);
    setOverlayWidth(undefined);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setMenuFor(null);
    setComposerFor(null);
    const id = String(event.active.id);
    setActiveId(id);
    const col = findColumn(id);
    if (col) setActiveCard(columns[col].find((c) => c.id === id) ?? null);
    setOverlayWidth(event.active.rect.current.initial?.width ?? undefined);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const from = findColumn(active.id);
    const to = findColumn(over.id);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const fromItems = prev[from];
      const toItems = prev[to];
      const fromIndex = fromItems.findIndex((c) => c.id === active.id);
      if (fromIndex === -1) return prev;
      const moved = fromItems[fromIndex];
      const overIndex = toItems.findIndex((c) => c.id === over.id);
      let newIndex: number;
      if (overIndex === -1) {
        newIndex = toItems.length;
      } else {
        const isBelow =
          active.rect.current.translated != null &&
          active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        newIndex = overIndex + (isBelow ? 1 : 0);
      }
      return {
        ...prev,
        [from]: fromItems.filter((c) => c.id !== moved.id),
        [to]: [...toItems.slice(0, newIndex), moved, ...toItems.slice(newIndex)],
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const col = findColumn(active.id);
    if (over && col && findColumn(over.id) === col) {
      const list = columns[col];
      const from = list.findIndex((c) => c.id === active.id);
      const to = list.findIndex((c) => c.id === over.id);
      if (from !== -1 && to !== -1 && from !== to) {
        setColumns((prev) => ({ ...prev, [col]: arrayMove(prev[col], from, to) }));
      }
    }
    resetDrag();
  };

  const addCard = (col: ColumnId) => {
    const title = draft.trim();
    if (!title) return;
    const card: Card = {
      id: crypto.randomUUID(),
      title,
      created: "Today",
      team: "3 Musketeer",
      priority: "Normal",
      assignee: "Unassigned",
    };
    setColumns((prev) => ({ ...prev, [col]: [...prev[col], card] }));
    setDraft("");
    setComposerFor(null);
  };

  const closeComposer = () => {
    setComposerFor(null);
    setDraft("");
  };

  const clearColumn = (col: ColumnId) => {
    const cards = columns[col];
    if (cards.length === 0) return;
    setColumns((prev) => ({ ...prev, [col]: [] }));
    setConfirmClear(false);
    setColumnOpen(false);
    setToastData({ kind: "clear", col, cards });
    setToastOpen(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOpen(false), 5000);
  };

  const undoClear = () => {
    if (!toastData) return;
    if (toastData.kind === "delete") {
      const { col, index, cards } = toastData;
      setColumns((prev) => {
        const next = [...prev[col]];
        next.splice(Math.min(index, next.length), 0, ...cards);
        return { ...prev, [col]: next };
      });
    } else {
      setColumns((prev) => ({ ...prev, [toastData.col]: toastData.cards }));
    }
    setToastOpen(false);
  };

  /* ── board actions the Pro components drive ───────────────────────────── */

  const pushNotif = (text: string) =>
    setNotifs((prev) => [{ id: crypto.randomUUID(), text, at: "now", read: false }, ...prev].slice(0, 24));

  const moveCard = (id: string, to: ColumnId) => {
    const from = findColumn(id);
    if (!from || from === to) return;
    setColumns((prev) => {
      const card = prev[from].find((c) => c.id === id);
      if (!card) return prev;
      return {
        ...prev,
        [from]: prev[from].filter((c) => c.id !== id),
        [to]: [...prev[to], card],
      };
    });
  };

  /* Completing a card moves it to Done and tells the inbox; reopening sends it
     back to the first column. */
  const completeCard = (id: string, el: HTMLElement) => {
    const from = findColumn(id);
    if (!from) return;
    const card = columns[from].find((c) => c.id === id);
    if (!card) return;
    const toDone = from !== "done";
    void el;
    moveCard(id, toDone ? "done" : "todo");
    if (!toDone) return;
    pushNotif(`You completed “${card.title}”`);
  };

  /* Deleting keeps the card in the toast so it stays undoable. */
  const deleteCard = (id: string, el: HTMLElement) => {
    const col = findColumn(id);
    if (!col) return;
    const index = columns[col].findIndex((c) => c.id === id);
    const card = columns[col][index];
    if (!card) return;
    void el;
    setColumns((prev) => ({ ...prev, [col]: prev[col].filter((c) => c.id !== id) }));
    setToastData({ kind: "delete", col, index, cards: [card] });
    setToastOpen(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastOpen(false), 5000);
    pushNotif(`You deleted “${card.title}”`);
  };

  const openDetail = (id: string) => {
    setDetailPhase("open");
    setNotifs((prev) => prev.map((n) => (n.read ? n : { ...n, read: true })));
    navigate(`/card/${id}`);
  };

  const closeDetail = () => {
    setDetailPhase("closing");
    const back = route.key === "backlog" ? "/backlog" : "/board";
    window.setTimeout(() => navigate(back), MODAL_CLOSE_MS);
  };

  const saveDetail = (patch: Partial<Card>) => {
    const id = route.cardId;
    if (!id) return;
    setColumns((prev) => {
      const next = { ...prev };
      (Object.keys(next) as ColumnId[]).forEach((k) => {
        next[k] = next[k].map((c) => (c.id === id ? { ...c, ...patch } : c));
      });
      return next;
    });
  };

  const detailCard = route.cardId
    ? (Object.keys(columns) as ColumnId[])
        .flatMap((k) => columns[k])
        .find((c) => c.id === route.cardId) ?? null
    : null;

  /* Where the breadcrumb says you are. */
  const viewCrumb =
    route.key === "overview"
      ? "Overview"
      : route.key === "update"
        ? "Update"
        : route.key === "inbox"
          ? "Inbox"
          : route.key === "soon"
            ? route.label ?? "Surface"
            : route.key === "backlog"
              ? "Backlog"
              : detailCard
                ? detailCard.title
                : "Board";
  const searching = query !== "" || (filterActive && prioritySel.length < 3);

  /* A new surface starts at the top: the panel you're leaving shouldn't decide
     where the panel you arrive on is scrolled to. */
  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-scroll-root]")) {
      el.scrollTop = 0;
    }
    setNotifOpen(false);
  }, [pathname]);

  /* Narrow viewports get the icon rail, wide ones get the full panel. The
     manual toggle still wins until the next threshold crossing. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1180px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* Persist the board and the inbox so a reload keeps the session. */
  useEffect(() => {
    try {
      localStorage.setItem("kanban:columns", JSON.stringify(columns));
    } catch {}
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem("kanban:notifs", JSON.stringify(notifs));
    } catch {}
  }, [notifs]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* A new surface starts at the top: the panel you're leaving shouldn't decide
     where the panel you arrive on is scrolled to. */
  useEffect(() => {
    for (const el of document.querySelectorAll<HTMLElement>("[data-scroll-root]")) {
      el.scrollTop = 0;
    }
    setNotifOpen(false);
  }, [pathname]);

  /* Narrow viewports get the icon rail, wide ones get the full panel. The
     manual toggle still wins until the next threshold crossing. */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1180px)");
    const apply = () => setCollapsed(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* Persist the board and the inbox so a reload keeps the session. */
  useEffect(() => {
    try {
      localStorage.setItem("kanban:columns", JSON.stringify(columns));
    } catch {}
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem("kanban:notifs", JSON.stringify(notifs));
    } catch {}
  }, [notifs]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const togglePriority = (p: Priority) =>
    setPrioritySel((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );

  return (
    <main className={styles.stage}>
      <section className={`${styles.appShell} ${collapsed ? styles.shellCollapsed : ""}`}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        issueCount={totalCards}
        onViewChange={selectSidebarView}
      />

        <div className={styles.content}>
          <header className={styles.topbar}>
            <div className={styles.topbarLead}>
            {/* Real breadcrumb: workspace → board → the view you're in, and the
                open card when one is open. Ancestors navigate, the last crumb
                is where you are. */}
            <nav className={styles.breadcrumb} aria-label="Breadcrumb">
              <Link to="/overview" className={styles.crumbLink}>
                Organizer
              </Link>
              <ChevronRight className={styles.crumbSep} size={13} aria-hidden />
              <span className={styles.docIcon} aria-hidden>
                ▱
              </span>
              <Link to="/board" className={styles.crumbLink}>
                {BOARD_NAME}
              </Link>
              <ChevronRight className={styles.crumbSep} size={13} aria-hidden />
              {detailCard ? (
                <>
                  <Link to={route.key === "backlog" ? "/backlog" : "/board"} className={styles.crumbLink}>
                    {viewCrumb}
                  </Link>
                  <ChevronRight className={styles.crumbSep} size={13} aria-hidden />
                  <strong className={styles.crumbCurrent} title={detailCard.title}>
                    {detailCard.title}
                  </strong>
                </>
              ) : (
                <strong className={styles.crumbCurrent} aria-current="page">
                  {viewCrumb}
                  {searching && <span className={styles.crumbNote}>filtered</span>}
                </strong>
              )}
            </nav>
            </div>
            <div className={styles.topbarActions}>
              {/* quick add: drops you into a new card in the first column */}
              <button
                className={styles.iconButton}
                onClick={() => {
                  navigate("/board");
                  setComposerFor((prev) => prev ?? "todo");
                }}
                aria-label="New card"
                title="New card"
              >
                <Plus size={15} />
              </button>
              <button className={styles.iconButton} title="Copy board link"><Link2 size={15} /></button>
              <div className={styles.bellWrap}>
                <button
                  className={`${styles.iconButton} ${notifOpen ? styles.iconButtonOn : ""}`}
                  aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                  aria-expanded={notifOpen}
                  title="Notifications"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    if (!notifOpen) setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
                  }}
                >
                  <Bell size={15} />
                  {unread > 0 && (
                    <span key={unread} className={styles.bellBadge}>
                      {unread}
                    </span>
                  )}
                </button>

                {/* the inbox dropdown */}
                {notifOpen && (
                  <>
                    <button
                      className={styles.popoverOverlay}
                      onClick={() => setNotifOpen(false)}
                      aria-label="Close notifications"
                    />
                    <div className={`${styles.menu} ${styles.menuOpen} ${styles.notifPanel}`}>
                      <div className={styles.notifHead}>
                        <strong>Notifications</strong>
                        <button
                          className={styles.notifClear}
                          onClick={() => setNotifs([])}
                          disabled={!notifs.length}
                        >
                          Clear all
                        </button>
                      </div>
                      {notifs.length === 0 ? (
                        <p className={styles.notifEmpty}>You're all caught up.</p>
                      ) : (
                        <ul className={styles.notifList}>
                          {notifs.slice(0, 6).map((n) => (
                            <li key={n.id} className={styles.notifItem}>
                              <span className={styles.notifDot} data-unread={!n.read} />
                              <span className={styles.notifText}>{n.text}</span>
                              <span className={styles.notifAt}>{n.at}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link to="/inbox" className={styles.notifAll} onClick={() => setNotifOpen(false)}>
                        View all notifications
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>

          <div className={styles.toolbar}>
            <div className={styles.tabs} role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  ref={(el) => {
                    if (el) tabRefs.current.set(t.id, el);
                    else tabRefs.current.delete(t.id);
                  }}
                  className={tab === t.id ? styles.activeTab : undefined}
                  onClick={() => selectTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
              <button className={styles.addTab} aria-label="Add tab"><Plus size={15} /></button>
            </div>
            <div className={styles.toolbarRight}>
              <label className={styles.searchBox}>
                <Search size={15} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                />
                {query !== "" && (
                  <button
                    className={styles.searchClear}
                    onClick={() => {
                      setQuery("");
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </label>
              <div className={styles.filterWrap}>
                <button
                  className={`${styles.toolButton} ${filterActive ? styles.toolButtonActive : ""}`}
                  onClick={() => (filterOpen ? setFilterOpen(false) : setFilterOpen(true))}
                  aria-label="Filter by priority"
                  aria-expanded={filterOpen}
                  title="Filter"
                >
                  <Filter size={15} />
                </button>
                {filterOpen && (
                  <>
                    <button
                      className={styles.popoverOverlay}
                      onClick={() => setFilterOpen(false)}
                      aria-label="Close filter"
                    />
                    <div
className={`${styles.menu} ${styles.menuOpen}`}
                    >
                      <div className={styles.menuLabel}>Filter by priority</div>
                      <div className={styles.chipRow}>
                        {PRIORITIES.map((p) => (
                          <button
                            key={p}
                            className={[
                              styles.chip,
                              styles[`priority${p}`],
                              prioritySel.includes(p) ? styles.chipOn : "",
                            ].join(" ")}
                            onClick={() => togglePriority(p)}
                          >
                            <span className={styles.priorityBars} aria-hidden>
                              <i /><i /><i />
                            </span>
                            {p}
                          </button>
                        ))}
                      </div>
                      {filterActive && (
                        <button className={styles.menuItem} onClick={() => setPrioritySel([])}>
                          <X size={13} /> Reset filter
                        </button>
                      )}
                      <div className={styles.menuMeta}>
                        Showing {totalVisible} of {totalCards} cards
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button className={styles.toolButton} aria-label="Display settings" title="Display settings">
                <Settings2 size={15} />
              </button>
              <button
                className={styles.toolButton}
                onClick={() => setHiddenOpen((v) => !v)}
                aria-label={hiddenOpen ? "Hide side panel" : "Show side panel"}
                title={hiddenOpen ? "Hide side panel" : "Show side panel"}
              >
                <PanelRight size={15} />
              </button>
            </div>
          </div>

          {tab === "issues" ? (
            <DndContext
              sensors={dndLocked ? [] : sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={resetDrag}
            >
              <div className={`${styles.board} ${hiddenOpen ? "" : styles.boardFull}`}>
                {COLUMNS.map((col) => {
                  const cards = visible[col.id];
                  return (
                    <section key={col.id} className={styles.column}>
                      <ColumnHeader
                        title={col.title}
                        tone={col.tone}
                        onAdd={() => {
                          setColumnOpen(false);
                          setComposerFor((prev) => (prev === col.id ? null : col.id));
                        }}
                        onMenu={() => {
                          closeComposer();
                          if (menuFor === col.id && columnOpen) {
                            setColumnOpen(false);
                          } else {
                            setConfirmClear(false);
                            setMenuFor(col.id);
                            setColumnOpen(true);
                          }
                        }}
                        menuActive={menuFor === col.id && columnOpen}
                      />

                      <DropZone columnId={col.id}>
                        <SortableContext
                          items={cards.map((c) => c.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {cards.map((card) => (
                            <SortableTaskCard
                              key={card.id}
                              card={card}
                              locked={dndLocked}
                              animate={activeId == null}
                              done={col.id === "done"}
                              onComplete={(el) => completeCard(card.id, el)}
                              onDelete={(el) => deleteCard(card.id, el)}
                              onOpen={() => openDetail(card.id)}
                            />
                          ))}
                        </SortableContext>

                        {composerFor === col.id && (
                          <form
                            className={styles.composer}
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (!draft.trim()) return;
                              addCard(col.id);
                            }}
                          >
                            <input
                              autoFocus
                              className={styles.composerInput}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Escape") closeComposer();
                              }}
                              placeholder="What needs to be done?"
                            />
                            <div className={styles.composerActions}>
                              <button
                                type="button"
                                className={styles.composerCancel}
                                onClick={closeComposer}
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className={styles.composerAdd}
                                disabled={!draft.trim()}
                              >
                                Add card
                              </button>
                            </div>
                          </form>
                        )}

                        {cards.length === 0 && composerFor !== col.id && (
                          <div className={styles.emptyHint}>
                            {dndLocked ? "No matching cards" : "Drop cards here"}
                          </div>
                        )}
                      </DropZone>

                      {menuFor === col.id && columnOpen && (
                        <>
                          <button
                            className={styles.popoverOverlay}
                            onClick={() => setColumnOpen(false)}
                            aria-label="Close menu"
                          />
                          <div
                            className={[
                              styles.menu, styles.menuOpen].join(" ")}
                          >
                            {confirmClear ? (
                              <>
                                <div className={styles.menuLabel}>Clear “{col.title}”?</div>
                                <button
                                  className={`${styles.menuItem} ${styles.menuDanger}`}
                                  onClick={() => clearColumn(col.id)}
                                >
                                  <Trash2 size={13} /> Yes, clear {columns[col.id].length}{" "}
                                  {columns[col.id].length === 1 ? "card" : "cards"}
                                </button>
                                <button
                                  className={styles.menuItem}
                                  onClick={() => setConfirmClear(false)}
                                >
                                  Keep cards
                                </button>
                              </>
                            ) : (
                              <button
                                className={styles.menuItem}
                                onClick={() => setConfirmClear(true)}
                                disabled={columns[col.id].length === 0}
                              >
                                <Trash2 size={13} /> Clear column
                              </button>
                            )}
                            <div className={styles.menuMeta}>
                              {columns[col.id].length} cards · {cards.length} shown
                            </div>
                          </div>
                        </>
                      )}
                    </section>
                  );
                })}

                {hiddenOpen && (
                  <aside className={styles.hiddenColumn}>
                    <div className={styles.hiddenTitle}>
                      <strong>Hidden column</strong>
                      <Ellipsis size={15} />
                    </div>
                    <div className={styles.hiddenItems}>
                      <button><Sparkles size={14} />Backlog</button>
                      <button><X size={14} />Canceled</button>
                      <button><span className={styles.duplicateIcon}>◌</span>Duplicated</button>
                    </div>
                  </aside>
                )}
              </div>

              <DragOverlay
                dropAnimation={{ duration: 220, easing: "cubic-bezier(.2, .7, .3, 1)" }}
              >
                {activeCard ? (
                  <div style={{ width: overlayWidth }}>
                    <TaskCard card={activeCard} floating />
                  </div>
                ) : null}
              </DragOverlay>

              {/* spinner-check-morph keeps the board's quick add in the topbar */}
            </DndContext>
          ) : (
            <div
              key={tab}
              className={`${styles.tabPanel} ${tab === "overview" ? styles.panelFill : ""}`}
            >
              {route.key === "overview" ? (
                <Overview
                  columns={columns}
                  colMeta={COLUMNS}
                  onPerson={(name) => {
                    setQuery(name);
                    navigate("/board");
                  }}
                />
              ) : route.key === "inbox" ? (
                <div className={styles.pageWrap} data-scroll-root>
                  <div className={styles.pageCard}>
                    <header className={styles.pageHead}>
                      <h2>Inbox</h2>
                      <button
                        className={styles.pageAction}
                        onClick={() => setNotifs([])}
                        disabled={!notifs.length}
                      >
                        Clear all
                      </button>
                    </header>
                    {notifs.length === 0 ? (
                      <p className={styles.pageEmpty}>You're all caught up.</p>
                    ) : (
                      <ul className={styles.pageList}>
                        {notifs.map((n) => (
                          <li key={n.id}>
                            <span className={styles.notifDot} data-unread={!n.read} />
                            <span>{n.text}</span>
                            <span className={styles.notifAt}>{n.at}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.pageWrap} data-scroll-root>
                  <div className={styles.pageCard}>
                    <header className={styles.pageHead}>
                      <h2>{route.label ?? "Update"}</h2>
                      {route.key === "update" && <span className={styles.pageTag}>in progress</span>}
                    </header>
                    <p className={styles.pageEmpty}>
                      This surface isn't built yet — the route is real, the page isn't.
                      Head back to the <Link to="/overview">Overview</Link> or the{" "}
                      <Link to="/board">Board</Link>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {toastData && toastOpen && (
        <div
          className={`${styles.toast} ${styles.toastOpen}`}
          role="status"
        >
          <span>
            {toastData.kind === "delete" ? (
              <>
                Deleted “{toastData.cards[0]?.title}”
              </>
            ) : (
              <>
                Cleared “{COLUMNS.find((c) => c.id === toastData.col)?.title}” —{" "}
                {toastData.cards.length} {toastData.cards.length === 1 ? "card" : "cards"}
              </>
            )}
          </span>
          <button className={styles.toastUndo} onClick={undoClear}>
            Undo
          </button>
        </div>
      )}

      {detailCard && (
        <CardDetail
          card={detailCard}
          phase={detailPhase}
          onClose={closeDetail}
          onSave={saveDetail}
          onDelete={() => {
            const id = detailCard.id;
            const slot = document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
            closeDetail();
            window.setTimeout(() => deleteCard(id, slot ?? document.body), MODAL_CLOSE_MS);
          }}
        />
      )}
    </main>
  );
}
