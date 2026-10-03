/**
 * @file Modal.tsx
 * @description Reusable accessible modal dialog component.
 *
 * Features:
 *  - Closes on pressing the Escape key (via `keydown` listener).
 *  - Closes on clicking outside the dialog content (click on overlay).
 *  - Supports `default`, `warning`, and `error` visual variants.
 *  - Renders `null` when `open` is `false` to avoid unnecessary DOM nodes.
 */

import { useEffect, useRef } from "react";
import "./Modal.css";

/**
 * Props accepted by the {@link Modal} component.
 */
interface ModalProps {
  /** Whether the modal is currently visible. */
  open: boolean;
  /** Title displayed in the modal header. */
  title: string;
  /** Content rendered in the modal body. */
  children: React.ReactNode;
  /** Callback invoked when the user closes the modal (Escape, overlay click, or ✕ button). */
  onClose: () => void;
  /**
   * Visual style variant.
   * - `"default"` – standard informational modal.
   * - `"warning"` – amber/orange styling for warnings.
   * - `"error"`   – red styling for error states.
   * @default "default"
   */
  variant?: "default" | "warning" | "error";
}

/**
 * Accessible modal dialog component.
 *
 * @param props - See {@link ModalProps}.
 * @returns The modal overlay element, or `null` when the modal is closed.
 */
export default function Modal({ open, title, children, onClose, variant = "default" }: ModalProps) {
  /** Ref to the overlay `<div>` used for click-outside detection. */
  const overlayRef = useRef<HTMLDivElement>(null);

  // Register / deregister the global Escape key listener whenever `open` changes
  useEffect(() => {
    if (!open) return;

    /**
     * Closes the modal when the user presses the Escape key.
     *
     * @param e - The keyboard event.
     */
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  // Do not render anything when the modal is closed
  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={(e) => {
        // Close when clicking the semi-transparent backdrop (not the dialog itself)
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className={`modal-content modal-${variant}`} role="dialog" aria-modal="true">
        {/* ── Modal header ── */}
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* ── Modal body (accepts arbitrary children) ── */}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
