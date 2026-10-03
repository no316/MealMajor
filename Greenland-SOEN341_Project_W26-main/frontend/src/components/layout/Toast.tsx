/**
 * @file Toast.tsx
 * @description Lightweight pub-sub toast notification system.
 *
 * Exports the `ToastContainer` React component that listens for
 * queued toasts and renders them with an auto-dismiss animation.
 *
 * The `showToast` function is available from `toastUtils.ts`.
 */

import { useEffect, useState } from "react";
import type { ToastItem } from "./toastUtils";
import { registerToastHandler } from "./toastUtils";
import "./Toast.css";

/**
 * Toast container component.
 *
 * Should be rendered once near the root of the application (e.g. in `App.tsx`)
 * so it is always present regardless of the current route.
 *
 * Each toast is automatically dismissed after 3 seconds with a CSS exit
 * animation lasting 350 ms.
 */
export default function ToastContainer() {
  /** The list of currently visible (or leaving) toasts. */
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    /**
     * Handler called by `showToast` for each new toast.
     * Adds the toast to state, then schedules:
     *  1. After 3 000 ms → marks the toast as `leaving` to trigger the exit animation.
     *  2. After 3 350 ms → removes the toast from state entirely.
     *
     * @param t - The incoming toast item.
     */
    const handler = (t: ToastItem) => {
      setToasts((prev) => [...prev, t]);

      // Begin exit animation after 3 seconds
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, leaving: true } : x))
        );

        // Remove from DOM after the animation completes
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
        }, 350);
      }, 3000);
    };

    // Register this component's handler with the module-level bus
    const unregister = registerToastHandler(handler);

    return unregister;
  }, []);

  // Render nothing when there are no active toasts
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}${t.leaving ? " toast-leaving" : ""}`}
          role="alert"
        >
          {/* Icon varies by toast type */}
          <span className="toast-icon">
            {t.type === "success" && "✓"}
            {t.type === "error" && "✕"}
            {t.type === "info" && "ℹ"}
          </span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
