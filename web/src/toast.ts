export interface ToastItem {
  id: number;
  message: string;
  kind: "error" | "hint";
  sticky: boolean;
}

export interface ResultNoticeInput {
  errorClass: string;
  errorMessage: string;
  missingVars?: string[];
  historyError?: string;
}

type Listener = (items: ToastItem[]) => void;

const ERROR_MS = 8000;
const HINT_MS = 3000;

let items: ToastItem[] = [];
let snapshot: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const deadlines = new Map<number, number>();
const remaining = new Map<number, number>();

function emit() {
  snapshot = items.slice();
  for (const listener of listeners) listener(snapshot);
}

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer !== undefined) clearTimeout(timer);
  timers.delete(id);
  deadlines.delete(id);
}

function arm(id: number, ms: number) {
  clearTimer(id);
  remaining.delete(id);
  deadlines.set(id, Date.now() + ms);
  timers.set(
    id,
    setTimeout(() => {
      dismiss(id);
    }, ms),
  );
}

export function getToasts(): ToastItem[] {
  return snapshot;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function enqueue(
  message: string,
  kind: ToastItem["kind"],
  sticky: boolean,
  ms: number,
) {
  if (message === "") return;
  const existing = items.find(
    (item) =>
      item.message === message && item.kind === kind && item.sticky === sticky,
  );
  if (existing) {
    if (!existing.sticky) arm(existing.id, ms);
    return;
  }
  const item: ToastItem = { id: nextId++, message, kind, sticky };
  items = [item, ...items];
  if (!sticky) arm(item.id, ms);
  emit();
}

export function notifyError(message: string) {
  enqueue(message, "error", false, ERROR_MS);
}

export function notifyHint(message: string) {
  enqueue(message, "hint", false, HINT_MS);
}

export function notifySticky(message: string) {
  enqueue(message, "error", true, 0);
}

export function dismiss(id: number) {
  clearTimer(id);
  remaining.delete(id);
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function pause(id: number) {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.sticky) return;
  const deadline = deadlines.get(id);
  if (deadline === undefined) return;
  remaining.set(id, Math.max(0, deadline - Date.now()));
  clearTimer(id);
}

export function resume(id: number) {
  const left = remaining.get(id);
  if (left === undefined) return;
  arm(id, left);
}

export function noticesForResult(result: ResultNoticeInput): string[] {
  const notices: string[] = [];
  const missing = (result.missingVars ?? []).filter((name) => name !== "");
  if (missing.length > 0) {
    notices.push(`缺少变量：${missing.join(", ")}`);
  } else if (result.errorMessage) {
    notices.push(
      result.errorClass
        ? `${result.errorClass}：${result.errorMessage}`
        : result.errorMessage,
    );
  } else if (result.errorClass && result.errorClass !== "http") {
    notices.push(result.errorClass);
  }
  if (result.historyError) {
    notices.push(`历史记录未写入：${result.historyError}`);
  }
  return notices;
}

export function publishResultNotices(result: ResultNoticeInput) {
  const notices = noticesForResult(result);
  for (let i = notices.length - 1; i >= 0; i--) {
    notifyError(notices[i]);
  }
}

export function resetToastsForTests() {
  for (const id of timers.keys()) clearTimer(id);
  remaining.clear();
  items = [];
  nextId = 1;
  emit();
}
