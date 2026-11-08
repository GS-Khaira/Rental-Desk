"use client";

import { useEffect, useRef, useState } from "react";
import { ROLE_INFO, initials } from "@/lib/roles";
import type { Role } from "@/lib/types";

export interface MenuPage { id: string; label: string; hint: string; badge?: number }
export interface MenuAction { label: string; hint: string; run: () => void }

/**
 * The header's menu button and the panel it opens: pages, exports and sign out.
 * The button shows the current page's name, so people always know where they are.
 */
export function MainMenu({ pages, current, exports, user, onSignOut }: {
  pages: MenuPage[];
  current: string;
  exports: MenuAction[];
  user: { name: string; email: string; role: Role | null };
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [exportsOpen, setExportsOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const currentPage = pages.find((p) => p.id === current);
  const waiting = pages.reduce((n, p) => n + (p.badge ?? 0), 0);

  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("[aria-current='page'], a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a, button") ?? []);
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
        next?.focus();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="menuwrap">
      <button ref={btnRef} type="button" className="menubtn" aria-haspopup="true" aria-expanded={open} aria-controls="main-menu"
        onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          {open
            ? <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            : <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />}
        </svg>
        <span className="menulabel">{currentPage?.label ?? "Menu"}</span>
        {waiting > 0 && !open && <span className="badge" aria-label={`${waiting} waiting`}>{waiting}</span>}
      </button>

      {open && (
        <>
          <div className="menuscrim" onClick={() => close(false)} />
          <div className="menupanel" id="main-menu" ref={panelRef} role="dialog" aria-label="Menu">
            <div className="menuuser">
              <span className={`avatar role-${user.role ?? "manager"}`} aria-hidden="true">{initials(user.name, user.email)}</span>
              <div style={{ minWidth: 0 }}>
                <div className="t ellipsis">{user.name || user.email}</div>
                <div className="row" style={{ gap: 6 }}>
                  {user.role && <span className={`pill role-${user.role}`}>{ROLE_INFO[user.role].label}</span>}
                  <span className="muted small ellipsis">{user.email}</span>
                </div>
              </div>
              <button type="button" className="btn small signout" onClick={() => { close(false); onSignOut(); }}>Sign out</button>
            </div>

            <div className="menusec" role="group" aria-label="Pages">
              <div className="label">Go to</div>
              {pages.map((p) => (
                <a key={p.id} href={"#" + p.id} className="menuitem" aria-current={p.id === current ? "page" : undefined} onClick={() => close(false)}>
                  <span><b>{p.label}</b><span className="muted small">{p.hint}</span></span>
                  {p.badge ? <span className="badge">{p.badge}</span> : null}
                </a>
              ))}
            </div>

            <div className="menusec" role="group" aria-label="Export">
              <button type="button" className="menuitem compact exporttoggle" aria-expanded={exportsOpen} aria-controls="menu-exports"
                onClick={() => setExportsOpen((o) => !o)}>
                <span><b>Export</b><span className="muted small">Spreadsheets and backups</span></span>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="chev">
                  <path d="M4 5.5l3 3 3-3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {exportsOpen && (
                <div id="menu-exports" className="submenu">
                  {exports.map((x) => (
                    <button key={x.label} type="button" className="menuitem compact" onClick={() => { x.run(); close(false); }}>
                      <span><b>{x.label}</b><span className="muted small">{x.hint}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
