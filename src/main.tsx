import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import KanbanDashboard from "./components/KanbanDashboard";
import "./index.css";

/* Static hosting (GitHub Pages) has no rewrite rule, so a deep path like /board
   would 404 on reload. `VITE_ROUTER=hash` builds with hash routes instead — the
   document path never changes, so every route is reloadable. Dev and
   server-backed hosting keep clean URLs. */
const Router = import.meta.env.VITE_ROUTER === "hash" ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <KanbanDashboard />
    </Router>
  </StrictMode>,
);
