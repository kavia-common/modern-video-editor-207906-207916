import React from "react";

/** Simple className joiner */
function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

// PUBLIC_INTERFACE
export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  children,
  className,
  ...props
}) {
  /** Retro-styled button component. */
  return (
    <button
      className={cx("btn", `btn--${variant}`, `btn--${size}`, className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? <span className="spinner" aria-hidden="true" /> : null}
      <span className="btn__label">{children}</span>
    </button>
  );
}

// PUBLIC_INTERFACE
export function Panel({ title, subtitle, right, children, className }) {
  /** Retro-styled container panel with header. */
  return (
    <section className={cx("panel", className)}>
      <header className="panel__header">
        <div className="panel__headerLeft">
          <div className="panel__title">{title}</div>
          {subtitle ? <div className="panel__subtitle">{subtitle}</div> : null}
        </div>
        {right ? <div className="panel__headerRight">{right}</div> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

// PUBLIC_INTERFACE
export function StatusPill({ tone = "neutral", children, className }) {
  /** Small pill used for connection state / selection state. */
  return <span className={cx("pill", `pill--${tone}`, className)}>{children}</span>;
}
