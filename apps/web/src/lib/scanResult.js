const KEY = "immatis.result";

export function saveResult(payload) {
  sessionStorage.setItem(KEY, JSON.stringify(payload));
}

export function loadResult() {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}
