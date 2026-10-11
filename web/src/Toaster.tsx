import { useSyncExternalStore } from "react";
import { dismiss, getToasts, pause, resume, subscribe } from "./toast";

export default function Toaster() {
  const items = useSyncExternalStore(subscribe, getToasts, getToasts);
  if (items.length === 0) return null;
  return (
    <div className="toaster">
      {items.map((item) => (
        <div
          key={item.id}
          className={
            item.kind === "error" ? "toast toast-error" : "toast toast-hint"
          }
          role={item.kind === "error" ? "alert" : "status"}
          onMouseEnter={() => pause(item.id)}
          onMouseLeave={() => resume(item.id)}
        >
          <p className="toast-message">{item.message}</p>
          <button
            type="button"
            className="toast-close"
            aria-label="关闭"
            onClick={() => dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
