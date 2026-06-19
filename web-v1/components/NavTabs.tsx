"use client";

import Link from "next/link";
import { ReactNode } from "react";

export function NavTabBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`nav-tab-bar ${className}`} role="tablist">
      {children}
    </div>
  );
}

export function NavTab({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`nav-tab ${active ? "nav-tab-active" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function NavTabLink({
  active,
  href,
  children,
  className = "",
}: {
  active: boolean;
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-current={active ? "page" : undefined}
      className={`nav-tab ${active ? "nav-tab-active" : ""} ${className}`}
    >
      {children}
    </Link>
  );
}
