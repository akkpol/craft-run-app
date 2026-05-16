"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ChevronDown, CircleAlert, MoreHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminToastTone = "success" | "error" | "warning";

export type AdminToastState = {
  tone: AdminToastTone;
  title: string;
  description?: string;
};

type AdminActionOption = {
  key: string;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: "default" | "destructive";
};

type AdminActionMenuProps = {
  actions: AdminActionOption[];
  onSelect: (key: string) => void;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
};

export function AdminActionToast({
  toast,
  onClose,
}: {
  toast: AdminToastState | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(timeout);
  }, [onClose, toast]);

  if (!toast) {
    return null;
  }

  const icon =
    toast.tone === "success" ? (
      <CheckCircle2 className="size-4 text-emerald-600" />
    ) : (
      <CircleAlert className="size-4 text-rose-600" />
    );

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-90 flex justify-end sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm">
      <div
        className={cn(
          "pointer-events-auto w-full rounded-2xl border bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.2)]",
          toast.tone === "success" && "border-emerald-200",
          toast.tone === "error" && "border-rose-200",
          toast.tone === "warning" && "border-amber-200"
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-950">{toast.title}</p>
            {toast.description ? (
              <p className="mt-1 text-sm text-slate-600">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminActionMenu({
  actions,
  onSelect,
  disabled = false,
  compact = false,
  label = "จัดการ",
  buttonVariant = "outline",
}: AdminActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      return undefined;
    }

    function updatePosition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (actions.length === 0) {
    return null;
  }

  const menu = open && position ? (
    <div
      ref={menuRef}
      style={{ top: position.top, right: position.right }}
      className="fixed z-[60] w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_60px_rgba(15,23,42,0.16)]"
    >
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          disabled={action.disabled}
          onClick={() => {
            setOpen(false);
            onSelect(action.key);
          }}
          className={cn(
            "flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition",
            action.disabled
              ? "cursor-not-allowed opacity-50"
              : "hover:bg-slate-50",
            action.tone === "destructive" && !action.disabled && "hover:bg-rose-50"
          )}
        >
          <span
            className={cn(
              "text-sm font-medium text-slate-900",
              action.tone === "destructive" && "text-rose-700"
            )}
          >
            {action.label}
          </span>
          {action.description ? (
            <span className="mt-1 text-xs leading-5 text-slate-500">
              {action.description}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative inline-flex">
      <Button
        ref={buttonRef}
        type="button"
        variant={buttonVariant}
        size={compact ? "xs" : "sm"}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          buttonVariant === "outline" && "border-slate-200 bg-white text-slate-700",
          buttonVariant === "secondary" && "border-slate-200 bg-slate-100/90 text-slate-800 hover:bg-slate-200/80",
          buttonVariant === "default" && "shadow-[0_12px_24px_rgba(0,94,140,0.18)] hover:shadow-[0_16px_30px_rgba(0,94,140,0.22)]"
        )}
      >
        {compact ? <MoreHorizontal className="size-3.5" /> : null}
        <span>{label}</span>
        {!compact ? <ChevronDown className="size-3.5" /> : null}
      </Button>

      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}

export function AdminActionSheet({
  open,
  onClose,
  title,
  description,
  badge,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="ปิดแผงจัดการ"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
      />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {badge ? (
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  {badge}
                </Badge>
              ) : null}
              <h3 className="mt-2 text-lg font-semibold text-slate-950">{title}</h3>
              {description ? (
                <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}