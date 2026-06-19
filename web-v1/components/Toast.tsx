"use client";

export type ToastKind = "info" | "success" | "error";
export type Toast = { id: number; kind: ToastKind; text: string };

function Icon({ kind }: { kind: ToastKind }) {
  if (kind === "success") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4">
        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "error") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" strokeLinecap="round" />
        <path d="M12 16h.01" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" strokeLinecap="round" />
      <path d="M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

export function ToastStack({ items, onDismiss }: { items: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`animate-slide-in pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-[0_18px_35px_-24px_rgba(15,23,42,0.28)] backdrop-blur-xl ${
            t.kind === "success"
              ? "border-[color-mix(in_oklab,var(--success),transparent_55%)] bg-[color-mix(in_oklab,var(--success),transparent_82%)] text-[var(--success)]"
              : t.kind === "error"
              ? "border-[color-mix(in_oklab,var(--danger),transparent_55%)] bg-[color-mix(in_oklab,var(--danger),transparent_82%)] text-[var(--danger)]"
              : "border-[var(--border)] bg-[var(--surface)]/92 text-[var(--foreground)]"
          }`}
        >
          <Icon kind={t.kind} />
          <span className="flex-1 leading-snug">{t.text}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-1 text-xs opacity-60 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
