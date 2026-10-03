/**
 * @file AppShell.tsx
 * @description Application shell layout component.
 *
 * Renders the two-panel application frame:
 *  - A collapsible sidebar with primary navigation links and a logout button.
 *  - A main content area with a top toolbar (mobile hamburger menu + breadcrumb).
 *
 * The sidebar can be:
 *  - Collapsed (icon-only) on desktop via the toggle button.
 *  - Opened as a drawer on mobile via the hamburger button.
 *
 * Active navigation links are detected by comparing the current pathname
 * to each known route using React Router's `matchPath`.
 */

import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, matchPath } from "react-router-dom";
import { useLogout } from "../../hooks/useLogout";
import "./AppShell.css";

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the CSS class for a sidebar navigation link.
 *
 * @param active - Whether the link corresponds to the current route.
 * @returns A space-joined class string, adding `"active"` when the link is current.
 */
function linkClass(active: boolean): string {
  return `app-shell-side-link${active ? " active" : ""}`;
}

/** A single breadcrumb entry. `to` is `null` for the current (non-clickable) crumb. */
type Crumb = { label: string; to: string | null };

/**
 * Derives breadcrumbs from the current pathname.
 *
 * @param pathname - The current `location.pathname`.
 * @returns An ordered array of breadcrumb entries.
 */
function breadcrumbsForPath(pathname: string): Crumb[] {
  if (matchPath({ path: "/viewRecipes", end: true }, pathname)) {
    return [{ label: "Recipes", to: null }];
  }
  if (matchPath({ path: "/createRecipe", end: true }, pathname)) {
    return [
      { label: "Recipes", to: "/viewRecipes" },
      { label: "New recipe", to: null },
    ];
  }
  if (matchPath({ path: "/editRecipe/:id", end: true }, pathname)) {
    return [
      { label: "Recipes", to: "/viewRecipes" },
      { label: "Edit recipe", to: null },
    ];
  }
  if (matchPath({ path: "/weeklyPlanner", end: true }, pathname)) {
    return [{ label: "Weekly planner", to: null }];
  }
  if (matchPath({ path: "/profile", end: true }, pathname)) {
    return [{ label: "Profile", to: null }];
  }
  if (matchPath({ path: "/dietAndMeals", end: true }, pathname)) {
    return [{ label: "3-Course Meal", to: null }];
  }
  // Fallback breadcrumb for any unknown path
  return [{ label: "MealMajor", to: "/viewRecipes" }];
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG icon components (aria-hidden so they are skipped by screen readers)
// ─────────────────────────────────────────────────────────────────────────────

/** Recipes / utensils icon. */
function IconRecipes() {
  return (
    <svg className="app-shell-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z"
      />
    </svg>
  );
}

/** Plus / new item icon. */
function IconPlus() {
  return (
    <svg className="app-shell-icon" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
    </svg>
  );
}

/** Calendar / meal plan icon. */
function IconCalendar() {
  return (
    <svg className="app-shell-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"
      />
    </svg>
  );
}

/** User / profile icon. */
function IconUser() {
  return (
    <svg className="app-shell-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
      />
    </svg>
  );
}

/** Hamburger / panel toggle icon. */
function IconPanel() {
  return (
    <svg className="app-shell-icon" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
    </svg>
  );
}

/** Chef / diet & meals icon. */
function IconChef() {
  return (
    <svg className="app-shell-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M11.99 5C6.47 5 2 8.58 2 13s4.47 8 9.99 8C17.52 21 22 17.42 22 13s-4.48-8-10.01-8zm3.5 9c.83 0 1.5-.67 1.5-1.5S15.33 11 14.5 11 13 11.67 13 12.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S8.33 11 7.5 11 6 11.67 6 12.5 6.67 14 7.5 14zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Application shell component.
 *
 * Renders a persistent sidebar and content area.  Child routes are rendered
 * inside the content area via React Router's `<Outlet />`.
 */
export default function AppShell() {
  const location = useLocation();
  const pathname = location.pathname;
  const logout = useLogout();

  /** Whether the sidebar is currently collapsed to icon-only mode. */
  const [collapsed, setCollapsed] = useState(false);

  /** Whether the mobile drawer is open (visible on small screens). */
  const [mobileOpen, setMobileOpen] = useState(false);

  /** Breadcrumbs derived from the current pathname – updated on navigation. */
  const crumbs = useMemo(() => breadcrumbsForPath(pathname), [pathname]);

  // Automatically close the mobile drawer on route changes

  /**
   * User initials derived from the stored user profile.
   * Falls back to `"?"` when the profile is unavailable or malformed.
   */
  const initials = useMemo(() => {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return "?";
      const u = JSON.parse(raw) as {
        firstName?: string;
        lastName?: string;
      };
      const a = u.firstName?.charAt(0) ?? "";
      const b = u.lastName?.charAt(0) ?? "";
      const s = `${a}${b}`.toUpperCase();
      return s || "?";
    } catch {
      return "?";
    }
  }, []);

  // ── Active link detection ──────────────────────────────────────────────
  const recipesActive =
    !!matchPath({ path: "/viewRecipes", end: true }, pathname) ||
    !!matchPath({ path: "/editRecipe/:id", end: true }, pathname);

  const createActive = !!matchPath(
    { path: "/createRecipe", end: true },
    pathname
  );

  const weeklyActive = !!matchPath(
    { path: "/weeklyPlanner", end: true },
    pathname
  );

  const profileActive = !!matchPath({ path: "/profile", end: true }, pathname);

  const dietAndMealsActive = !!matchPath(
    { path: "/dietAndMeals", end: true },
    pathname
  );

  return (
    <div
      className={`app-shell${mobileOpen ? " app-shell--drawer-open" : ""}`}
    >
      {/* ── Mobile backdrop (tap to close the drawer) ── */}
      <button
        type="button"
        className="app-shell-backdrop"
        aria-label="Close menu"
        aria-hidden={!mobileOpen}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar ── */}
      <aside
        className={`app-shell-sidebar ${collapsed ? "app-shell-sidebar--collapsed" : ""} ${mobileOpen ? "app-shell-sidebar--open" : ""}`}
        aria-label="Main navigation"
      >
        {/* Brand / logo row */}
        <div className="app-shell-brand-block">
          <div className="app-shell-brand-row">
            <Link
              to="/viewRecipes"
              className="app-shell-brand"
              onClick={() => setMobileOpen(false)}
              title="MealMajor"
            >
              {/* Show abbreviated brand when collapsed */}
              {collapsed ? "MM" : "MealMajor"}
            </Link>
            <button
              type="button"
              className="app-shell-collapse-toggle"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              <IconPanel />
            </button>
          </div>
          {/* Tagline — hidden when collapsed */}
          {!collapsed && (
            <p className="app-shell-tagline">Meal planning &amp; recipes</p>
          )}
        </div>

        {/* Section label — visually hidden when collapsed */}
        <p
          className={`app-shell-nav-label ${collapsed ? "app-shell-nav-label--hidden" : ""}`}
        >
          Navigation
        </p>

        {/* ── Primary navigation links ── */}
        <nav className="app-shell-side-nav">
          <Link
            to="/viewRecipes"
            className={linkClass(recipesActive)}
            onClick={() => setMobileOpen(false)}
          >
            <IconRecipes />
            <span className="app-shell-side-text">Recipes</span>
          </Link>
          <Link
            to="/createRecipe"
            className={linkClass(createActive)}
            onClick={() => setMobileOpen(false)}
          >
            <IconPlus />
            <span className="app-shell-side-text">New recipe</span>
          </Link>
          <Link
            to="/weeklyPlanner"
            className={linkClass(weeklyActive)}
            onClick={() => setMobileOpen(false)}
          >
            <IconCalendar />
            <span className="app-shell-side-text">Weekly planner</span>
          </Link>
          <Link
            to="/dietAndMeals"
            className={linkClass(dietAndMealsActive)}
            onClick={() => setMobileOpen(false)}
          >
            <IconChef />
            <span className="app-shell-side-text">3-Course Meal</span>
          </Link>
          <Link
            to="/profile"
            className={linkClass(profileActive)}
            onClick={() => setMobileOpen(false)}
          >
            <IconUser />
            <span className="app-shell-side-text">Profile</span>
          </Link>
        </nav>

        {/* ── Sidebar footer: user avatar + logout ── */}
        <div className="app-shell-sidebar-footer">
          <div className="app-shell-footer-inner">
            {/* Avatar links to the profile page */}
            <Link
              to="/profile"
              className="app-shell-avatar"
              aria-label="Open profile"
              onClick={() => setMobileOpen(false)}
            >
              {initials}
            </Link>

            {/* Expanded sidebar: shows "Log out" text */}
            {!collapsed && (
              <button
                type="button"
                className="app-shell-logout"
                onClick={logout}
              >
                Log out
              </button>
            )}

            {/* Collapsed sidebar: icon-only logout button */}
            {collapsed && (
              <button
                type="button"
                className="app-shell-logout app-shell-logout--icon"
                onClick={logout}
                aria-label="Log out"
                title="Log out"
              >
                <span aria-hidden>⎋</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div className="app-shell-body">
        {/* Top toolbar: mobile hamburger button + breadcrumb navigation */}
        <header className="app-shell-toolbar">
          <button
            type="button"
            className="app-shell-menu-btn"
            aria-label="Open navigation menu"
            onClick={() => setMobileOpen(true)}
          >
            <IconPanel />
          </button>

          {/* Breadcrumb nav – derived from the current pathname */}
          <nav className="app-shell-breadcrumb" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="app-shell-crumb">
                {/* Separator between crumbs (not shown before the first) */}
                {i > 0 && (
                  <span className="app-shell-crumb-sep" aria-hidden>
                    /
                  </span>
                )}
                {/* Last crumb is plain text; earlier crumbs are clickable links */}
                {c.to ? (
                  <Link to={c.to}>{c.label}</Link>
                ) : (
                  <span className="app-shell-crumb-current">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        </header>

        {/* The matched child route is rendered here */}
        <main className="app-shell-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
