import { navigate } from "raviger";

export function goBack(fallback?: string) {
  if (window.history.length > 1 || !fallback) {
    window.history.back();
    return;
  }
  navigate(fallback, { replace: true });
}
