import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Ellipsis,
  Github,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  PackageOpen,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import type { SidebarView } from "./KanbanDashboard";
import styles from "./Sidebar.module.css";

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  nested?: boolean;
  /** real page for this row; rows without one are placeholders */
  to?: string;
};

const MAIN_NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: <KanbanSquare size={13} />, to: "/overview" },
  { id: "inbox", label: "Inbox", icon: <Inbox size={13} />, badge: 3, to: "/inbox" },
  { id: "my-issues", label: "My issue", icon: <LayoutDashboard size={13} /> },
];

const WORKSPACE_NAV: NavItem[] = [
  { id: "projects", label: "Projects", icon: <PackageOpen size={13} /> },
  { id: "views", label: "Views", icon: <LayoutDashboard size={13} /> },
  { id: "more", label: "More", icon: <Ellipsis size={13} /> },
];

/* The board tree: real surfaces of this board, not placeholder labels. */
const BOARD_NAV: NavItem[] = [
  { id: "board", label: "Board", icon: <KanbanSquare size={12} />, nested: true, to: "/board" },
  { id: "backlog", label: "Backlog", icon: <Inbox size={12} />, nested: true, to: "/backlog" },
];

/* The board's members: stacked by default, fanned out on hover. */
const MEMBERS = [
  { name: "Mark", initials: "M", hue: 6, dx: -7, drot: -7, z: 1 },
  { name: "Andrew", initials: "A", hue: 212, dx: 7, drot: 7, z: 0 },
  { name: "Jimmy", initials: "J", hue: 152, dx: 0, drot: 0, z: 2 },
];

const FOOTER_NAV: NavItem[] = [
  { id: "back-agents", label: "Back to agents", icon: <ChevronLeft size={12} /> },
  {
    id: "help",
    label: "Help and resource",
    icon: <span className={styles.helpIcon}>?</span>,
  },
];

function SideRow({
  item,
  active,
  onClick,
  trailing,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      className={[
        styles.sideRow,
        item.nested ? styles.sideRowNested : "",
        active ? styles.sideRowActive : "",
      ].join(" ")}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <span className={styles.rowIcon}>{item.icon}</span>
      <span className={styles.rowLabel}>{item.label}</span>
      {item.badge != null && (
        <span className={styles.rowBadge}>
          <AnimatedNumber value={item.badge} />
        </span>
      )}
      {trailing}
    </button>
  );
}

/* number-pop-in: digits pop in with blur + stagger; the key on `value`
   remounts the group so the animation replays whenever the count changes. */
function AnimatedNumber({ value }: { value: number }) {
  return (
    <span key={value} className={`${styles.digitGroup} ${styles.digitGo}`}>
      {String(value)
        .split("")
        .map((d, i) => (
          <span
            key={i}
            className={styles.digit}
            data-stagger={i ? String(Math.min(i, 2)) : undefined}
          >
            {d}
          </span>
        ))}
    </span>
  );
}

/* The mark is six spokes around a centre; used bare when expanded and wrapped
   in a button when collapsed, where it doubles as the expand control. */
function LogoMark() {
  return (
    <span className={styles.logoMark}>
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  issueCount,
  onViewChange,
}: {
  collapsed: boolean;
  onToggle: () => void;
  issueCount: number;
  onViewChange: (view: SidebarView) => void;
}) {
  /* No local selection by default: the tree's Board row owns the highlight for
     the board view, so only one row ever reads as "where you are". */
  const [activeId, setActiveId] = useState("");
  const [treeOpen, setTreeOpen] = useState(true);

  const rows = (items: NavItem[], extra?: (item: NavItem) => React.ReactNode) =>
    items.map((item) => {
      const withCount = item.id === "my-issues" ? { ...item, badge: issueCount } : item;
      /* Real anchors for real pages: NavLink marks the current one, and the row
         stays a plain button when its surface isn't built yet. */
      if (item.to) {
        return (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) =>
              [styles.sideRow, item.nested ? styles.sideRowNested : "", isActive ? styles.sideRowActive : ""].join(" ")
            }
            aria-current={undefined}
          >
            <span className={styles.rowIcon}>{withCount.icon}</span>
            <span className={styles.rowLabel}>{withCount.label}</span>
            {withCount.badge != null && (
              <span className={styles.rowBadge}>
                <AnimatedNumber value={withCount.badge} />
              </span>
            )}
            {extra?.(item)}
          </NavLink>
        );
      }
      return (
        <SideRow
          key={item.id}
          item={withCount}
          active={activeId === item.id}
          onClick={() => {
            setActiveId(item.id);
            /* Overview has a page; the rest are saved views that don't yet */
            if (item.id === "overview") onViewChange("overview");
          }}
          trailing={extra?.(item)}
        />
      );
    });

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.sidebarTop}>
        {/* the mark is the way home: to the dashboard, from anywhere */}
        <Link
          to="/overview"
          className={styles.logoWrap}
          aria-label="Organizer — go to the overview"
          title="Go to the overview"
        >
          <LogoMark />
          <span className={styles.logoText}>Organizer</span>
        </Link>
        <button
          className={styles.collapseButton}
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className={styles.iconSwap} data-state={collapsed ? "b" : "a"}>
            <span className={styles.iconSwapItem} data-icon="a">
              <ChevronLeft size={14} />
            </span>
            <span className={styles.iconSwapItem} data-icon="b">
              <ChevronRight size={14} />
            </span>
          </span>
        </button>
      </div>

      <nav className={styles.nav} data-scroll-root>
        <div className={styles.navGroup}>{rows(MAIN_NAV)}</div>

        <div className={styles.navSection}>
          <div className={styles.sectionLabel}>Workspace</div>
          {rows(WORKSPACE_NAV)}
        </div>

        <div className={styles.navSection}>
          <div className={styles.sectionLabel}>Your boards</div>
          <button
            className={`${styles.sideRow} ${styles.boardRow}`}
            onClick={() => setTreeOpen((v) => !v)}
            aria-expanded={treeOpen}
          >
            <span className={styles.rowIcon}>
              <span className={styles.teamBadge}>
                <KanbanSquare size={10} />
              </span>
            </span>
            <span className={styles.rowLabel}>Task Progress</span>
            <span className={styles.rowBadge}>
              <AnimatedNumber value={issueCount} />
            </span>
            <span
              className={`${styles.rowChevron} ${treeOpen ? styles.rowChevronOpen : ""}`}
              aria-hidden
            >
              <ChevronDown size={12} />
            </span>
          </button>
          <div
            className={`${styles.treeWrap} ${treeOpen ? "" : styles.treeWrapClosed}`}
            role="group"
            aria-label="Task Progress board"
            aria-hidden={!treeOpen}
          >
            <div className={styles.treeInner}>
              <div className={styles.tree}>
                {rows(BOARD_NAV)}
              </div>

              {/* the board's members: an avatar cluster that fans out on hover */}
              <div className={styles.members}>
                <div className={styles.avatars} aria-hidden="true">
                  {MEMBERS.map((m) => (
                    <span
                      key={m.name}
                      className={styles.avatar}
                      style={
                        {
                          "--av-x": `${m.dx}px`,
                          "--av-rot": `${m.drot}deg`,
                          zIndex: m.z,
                          background: `linear-gradient(140deg, hsl(${m.hue} 72% 62%), hsl(${m.hue + 26} 68% 46%))`,
                        } as React.CSSProperties
                      }
                    >
                      {m.initials}
                    </span>
                  ))}
                </div>
                <span className={styles.membersLabel}>
                  <UsersRound size={13} />
                  {MEMBERS.length} members
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.navSection}>
          <SideRow
            item={{ id: "import", label: "Import issue", icon: <CirclePlus size={13} /> }}
            active={activeId === "import"}
            onClick={() => setActiveId("import")}
          />
          <SideRow
            item={{ id: "invite", label: "Invite people", icon: <UserRoundPlus size={13} /> }}
            active={activeId === "invite"}
            onClick={() => setActiveId("invite")}
          />
          <SideRow
            item={{ id: "github", label: "Connect Github", icon: <Github size={13} /> }}
            active={activeId === "github"}
            onClick={() => setActiveId("github")}
          />
        </div>
      </nav>

      <div className={styles.sidebarBottom}>{rows(FOOTER_NAV)}</div>
    </aside>
  );
}
