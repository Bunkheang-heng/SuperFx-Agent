import {
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export function Card({
  title,
  subtitle,
  icon,
  action,
  children,
  className = "",
  padded = true,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={`card-lift rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_18px_45px_-30px_rgba(0,0,0,0.45)] ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {(title || action) && (
        <header className={`flex items-start justify-between gap-3 ${padded ? "mb-4" : "p-5 pb-4"}`}>
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[color-mix(in_oklab,var(--brand-blue),transparent_70%)] bg-[color-mix(in_oklab,var(--brand-blue),transparent_90%)] text-[var(--brand-blue-bright)]">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)] leading-tight">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-xs text-[var(--muted)] mt-1 leading-snug">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  loading = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] active:scale-[0.98]";
  const sizes: Record<Size, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-3.5 py-2 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary:
      "bg-[var(--btn-primary)] text-white hover:bg-[var(--btn-primary-hover)] border border-[color-mix(in_oklab,var(--btn-primary),transparent_30%)]",
    secondary:
      "bg-[var(--surface-2)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-3)] hover:border-[var(--border-strong)]",
    ghost:
      "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] border border-transparent hover:border-[var(--border)]",
    danger:
      "bg-[var(--danger)] text-white hover:bg-[var(--danger-soft)]",
    success:
      "bg-[var(--btn-success)] text-[#0a101c] font-semibold hover:bg-[var(--btn-success-hover)] border border-[color-mix(in_oklab,var(--btn-success),transparent_35%)]",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading && (
        <svg className="animate-spin-slow h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function Badge({
  tone = "default",
  children,
  pulse = false,
}: {
  tone?: "default" | "success" | "danger" | "warning" | "accent" | "info";
  children: ReactNode;
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    default: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
    success:
      "bg-[color-mix(in_oklab,var(--success),transparent_82%)] text-[var(--success)] border-[color-mix(in_oklab,var(--success),transparent_55%)]",
    danger:
      "bg-[color-mix(in_oklab,var(--danger),transparent_82%)] text-[var(--danger)] border-[color-mix(in_oklab,var(--danger),transparent_55%)]",
    warning:
      "bg-[color-mix(in_oklab,var(--warning),transparent_82%)] text-[var(--warning)] border-[color-mix(in_oklab,var(--warning),transparent_55%)]",
    accent:
      "bg-[color-mix(in_oklab,var(--accent),transparent_82%)] text-[var(--accent)] border-[color-mix(in_oklab,var(--accent),transparent_55%)]",
    info:
      "bg-[color-mix(in_oklab,var(--info),transparent_82%)] text-[var(--info)] border-[color-mix(in_oklab,var(--info),transparent_55%)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]} ${
        pulse ? "animate-fade-in" : ""
      }`}
    >
      {children}
    </span>
  );
}

const JSON_VIEW_CHAR_CAP = 110_000;

export function JsonView({ data, max = 340 }: { data: unknown; max?: number }) {
  const text = useMemo(() => {
    try {
      const raw = JSON.stringify(data, null, 2);
      if (raw.length <= JSON_VIEW_CHAR_CAP) return raw;
      return `${raw.slice(0, JSON_VIEW_CHAR_CAP)}\n\n...[JSON truncated at ${JSON_VIEW_CHAR_CAP} characters for memory cap]`;
    } catch {
      return String(data);
    }
  }, [data]);

  return (
    <pre
      className="overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-3)] p-3 text-xs font-mono leading-relaxed text-[var(--foreground)]/90 shadow-inner"
      style={{ maxHeight: max }}
    >
      {text}
    </pre>
  );
}

export function Dot({
  tone = "muted",
  pulse = false,
}: {
  tone?: "muted" | "success" | "danger" | "warning" | "accent";
  pulse?: boolean;
}) {
  const map: Record<string, string> = {
    muted: "bg-[var(--muted)]",
    success: "bg-[var(--success)]",
    danger: "bg-[var(--danger)]",
    warning: "bg-[var(--warning)]",
    accent: "bg-[var(--accent)]",
  };
  const pulseCls =
    tone === "success"
      ? "animate-pulse-ring-success"
      : tone === "accent"
      ? "animate-pulse-ring-accent"
      : "";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${map[tone]} ${pulse ? pulseCls : ""}`}
    />
  );
}

export function FieldLabel({ children, ...props }: HTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
    >
      {children}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { leading?: ReactNode }>(
  function Input({ className = "", leading, ...props }, ref) {
    return (
      <div className="relative flex items-center">
        {leading && (
          <span className="pointer-events-none absolute left-3 flex items-center text-[var(--muted)]">
            {leading}
          </span>
        )}
        <input
          ref={ref}
          {...props}
          className={`w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] ${
            leading ? "pl-9" : "px-3"
          } pr-3 py-2 text-sm outline-none transition placeholder:text-[var(--muted-2)] hover:border-[var(--border-strong)] focus:border-[var(--accent)]/60 focus:ring-2 focus:ring-[var(--accent)]/25 ${className}`}
        />
      </div>
    );
  },
);

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "accent";
  icon?: ReactNode;
}) {
  const toneClass: Record<string, string> = {
    default: "text-[var(--foreground)]",
    success: "text-[var(--success)]",
    warning: "text-[var(--warning)]",
    danger: "text-[var(--danger)]",
    accent: "text-[var(--accent-2)]",
  };
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/70 p-3.5 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </div>
        {icon && <span className="text-[var(--muted)]">{icon}</span>}
      </div>
      <div className={`mt-1.5 font-mono text-[15px] font-medium tracking-tight ${toneClass[tone]}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function LiveValue({
  value,
  display,
  className = "",
}: {
  value: number | null;
  display: ReactNode;
  className?: string;
}) {
  const prevValue = useRef<number | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value == null) {
      prevValue.current = value;
      return;
    }
    if (prevValue.current != null && value !== prevValue.current) {
      setFlash(value > prevValue.current ? "up" : "down");
      const timeoutId = window.setTimeout(() => setFlash(null), 800);
      prevValue.current = value;
      return () => window.clearTimeout(timeoutId);
    }
    prevValue.current = value;
  }, [value]);

  return (
    <span
      className={`inline-flex rounded-md px-1.5 py-0.5 transition-colors ${
        flash === "up" ? "animate-value-up" : flash === "down" ? "animate-value-down" : ""
      } ${className}`}
    >
      {display}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
      {children}
    </h3>
  );
}

export function Divider() {
  return <div className="my-4 h-px w-full bg-[var(--border)]" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--muted)]">
      {children}
    </kbd>
  );
}
