/**
 * @file toastUtils.ts
 * @description Utility functions and types for the toast notification system.
 */

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  /** Unique auto-incremented identifier. */
  id: number;
  /** Human-readable message to display. */
  message: string;
  /** Semantic type driving colour/icon. */
  type: ToastType;
  /** Set to `true` during the CSS exit animation before the item is removed. */
  leaving?: boolean;
}

/** Module-level counter used to assign unique IDs to each toast. */
let toastIdCounter = 0;

/**
 * Module-level listener registry.
 * `ToastContainer` registers/deregisters a handler here to receive new toasts.
 */
const listeners: Array<(t: ToastItem) => void> = [];

/**
 * Enqueue a new toast notification.
 *
 * Can be called from anywhere in the app without needing a React context:
 * ```ts
 * import { showToast } from "../layout/toastUtils";
 * showToast("Recipe saved!", "success");
 * ```
 *
 * @param message - The text to display inside the toast.
 * @param type    - Severity level controlling the colour/icon. Defaults to `"info"`.
 */
export function showToast(message: string, type: ToastType = "info") {
  const item: ToastItem = { id: ++toastIdCounter, message, type };
  // Notify all registered listeners (normally just the single ToastContainer instance)
  listeners.forEach((fn) => fn(item));
}

/**
 * Register a handler to receive toast notifications.
 * Returns a function to unregister the handler.
 *
 * @param handler - The function to call when a new toast is shown.
 * @returns A function to unregister the handler.
 */
export function registerToastHandler(handler: (t: ToastItem) => void) {
  listeners.push(handler);
  return () => {
    const idx = listeners.indexOf(handler);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
