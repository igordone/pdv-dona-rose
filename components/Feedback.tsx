import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = Required<Pick<ToastInput, "title">> & {
  id: number;
  description: string;
  variant: ToastVariant;
  durationMs: number;
};

type ConfirmInput = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type FeedbackContextValue = {
  toast: (input: ToastInput) => void;
  confirm: (input: ConfirmInput) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

let nextToastId = 1;

function ToastBar({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [onClose, toast.durationMs, toast.id]);

  return (
    <div
      className="feedback-toast card"
      data-variant={toast.variant}
      style={{
        overflow: "hidden",
        borderRadius: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>{toast.title}</strong>
          {toast.description ? <div className="muted">{toast.description}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => onClose(toast.id)}
          aria-label="Fechar notificação"
          className="btn btn-ghost"
          style={{
            minWidth: 28,
            width: 28,
            height: 28,
            borderRadius: "999px",
            padding: 0,
            display: "grid",
            placeItems: "center",
            lineHeight: 1,
            flex: "0 0 auto",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            close
          </span>
        </button>
      </div>
      <div className="feedback-toast-progress" style={{ animationDuration: `${toast.durationMs}ms` }} />
    </div>
  );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    danger: boolean;
    resolve: ((value: boolean) => void) | null;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
    danger: false,
    resolve: null,
  });

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = nextToastId++;
    setToasts((current) => [
      ...current,
      {
        id,
        title: input.title,
        description: input.description ?? "",
        variant: input.variant ?? "info",
        durationMs: input.durationMs ?? 3200,
      },
    ]);
  }, []);

  const confirm = useCallback((input: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        title: input.title,
        description: input.description,
        confirmLabel: input.confirmLabel ?? "Confirmar",
        cancelLabel: input.cancelLabel ?? "Cancelar",
        danger: input.danger ?? true,
        resolve,
      });
    });
  }, []);

  const value = useMemo(
    () => ({
      toast,
      confirm,
    }),
    [confirm, toast],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          zIndex: 100,
          display: "grid",
          gap: 12,
          width: "min(380px, calc(100vw - 32px))",
        }}
      >
        {toasts.map((toastItem) => (
          <ToastBar key={toastItem.id} toast={toastItem} onClose={removeToast} />
        ))}
      </div>

      {confirmState.open ? (
        <div
          role="presentation"
          onClick={() => {
            confirmState.resolve?.(false);
            setConfirmState((current) => ({ ...current, open: false, resolve: null }));
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 110,
            background: "rgba(15, 23, 42, 0.58)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={confirmState.title}
            onClick={(event) => event.stopPropagation()}
            className="card card-pad"
            style={{ width: "min(520px, 100%)" }}
          >
            <h2 className="section-title" style={{ marginBottom: 10 }}>
              {confirmState.title}
            </h2>
            <p className="subtitle" style={{ marginBottom: 20 }}>
              {confirmState.description}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  confirmState.resolve?.(false);
                  setConfirmState((current) => ({ ...current, open: false, resolve: null }));
                }}
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className={confirmState.danger ? "btn btn-danger" : "btn btn-primary"}
                onClick={() => {
                  confirmState.resolve?.(true);
                  setConfirmState((current) => ({ ...current, open: false, resolve: null }));
                }}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }

  return context;
}
