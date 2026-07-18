"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

interface Toast {
  id: number;
  message: string;
  ok: boolean;
}

const ToastContext = createContext<(message: string, ok?: boolean) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, ok = true) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message, ok }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="rise pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg border border-hairline bg-surface px-4 py-3 text-sm shadow-lg shadow-black/5"
          >
            {t.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-red" />
            )}
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
