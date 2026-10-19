import { useCallback, useRef, useState } from "react";
import { ToastContext } from "./useToast.js";

const SHOW_MS = 3500;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]); // [{ id, text, type }]
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (text, type = "success") => {
      const id = nextId.current++;
      setToasts((list) => [...list, { id, text, type }]);
      setTimeout(() => dismiss(id), SHOW_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* role="status": screen readers announce new messages */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-md px-4 py-3 text-sm text-white shadow-lg ${
              t.type === "error" ? "bg-red-700" : "bg-gray-900"
            }`}
          >
            <span className="flex-1">{t.text}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
