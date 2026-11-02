"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Kind = "loading" | "success" | "error" | "info";
interface Item {
  id: number;
  kind: Kind;
  text: string;
}
export interface ToastHandle {
  success(text: string): void;
  error(text: string): void;
  dismiss(): void;
}
interface Api {
  loading(text: string): ToastHandle;
  success(text: string): void;
  error(text: string): void;
  info(text: string): void;
}

const Ctx = createContext<Api | null>(null);

export function useToast(): Api {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast ต้องอยู่ใน ToastProvider");
  return v;
}

const AUTO_MS: Record<Kind, number> = { loading: 0, success: 3500, info: 4000, error: 9000 };
const ICON: Record<Kind, string> = { loading: "", success: "✓", error: "✕", info: "i" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((l) => l.filter((x) => x.id !== id));
  }, []);

  const put = useCallback(
    (id: number, kind: Kind, text: string) => {
      setItems((l) => (l.some((x) => x.id === id) ? l.map((x) => (x.id === id ? { id, kind, text } : x)) : [...l, { id, kind, text }]));
      const old = timers.current.get(id);
      if (old) clearTimeout(old);
      if (AUTO_MS[kind] > 0) timers.current.set(id, setTimeout(() => dismiss(id), AUTO_MS[kind]));
    },
    [dismiss],
  );

  const api = useMemo<Api>(() => {
    const once = (kind: Kind) => (text: string) => put(++seq.current, kind, text);
    return {
      loading(text) {
        const id = ++seq.current;
        put(id, "loading", text);
        return {
          success: (t) => put(id, "success", t),
          error: (t) => put(id, "error", t),
          dismiss: () => dismiss(id),
        };
      },
      success: once("success"),
      error: once("error"),
      info: once("info"),
    };
  }, [put, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts no-print" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="ticon">{t.kind === "loading" ? <span className="spin" /> : ICON[t.kind]}</span>
            <span className="ttext">{t.text}</span>
            {t.kind !== "loading" && (
              <button className="tclose" aria-label="ปิด" onClick={() => dismiss(t.id)}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
