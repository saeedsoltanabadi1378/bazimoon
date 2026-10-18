import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/app.css";
// Catches the browser's install event as early as possible.
import "./lib/install";
import App from "./App.tsx";
import AdminApp from "./admin/AdminApp.tsx";

const isAdmin = window.location.pathname.startsWith("/admin");
document.documentElement.classList.toggle("admin-page", isAdmin);
// The admin console stays out of search results.
if (isAdmin) document.querySelector("meta[name=robots]")?.setAttribute("content", "noindex, nofollow");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? <AdminApp /> : <App />}
  </StrictMode>,
);
