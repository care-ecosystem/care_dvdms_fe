const isAppleDevice = /iPhone|iPad|iPod|Mac/i.test(navigator.userAgent);

/**
 * Formats a keyboard shortcut string for display, using appropriate symbols for
 * modifier keys based on the user's operating system.
 *
 * Examples:
 * - "ctrl+k" -> "⌘ + K" (on macOS) or "CTRL + K" (on other OS)
 * - "shift+p" -> "⇧ + P"
 * - "g p" -> "G + P"
 */
export function formatKeyboardShortcut(key: string): string {
  if (key.includes("+")) {
    const parts = key.split("+");
    return parts
      .map((k) => {
        const lower = k.toLowerCase();
        if (lower === "ctrl" || lower === "cmd" || lower === "meta") {
          return isAppleDevice ? "⌘" : "CTRL";
        }
        if (lower === "shift") {
          return "⇧";
        }
        if (lower === "alt") {
          return isAppleDevice ? "⌥" : "ALT";
        }
        return k.toUpperCase();
      })
      .join(" + ");
  } else if (key.includes(" ")) {
    return key
      .split(" ")
      .map((k) => k.toUpperCase())
      .join(" + ");
  } else {
    if (key === "arrowDown") return "↓";
    if (key === "escape") return "ESC";
    if (key === "arrowLeft") return "←";
    return key.toUpperCase();
  }
}

const clickDebounceMap = new Map<string, number>();

export function shortcutActionHandler(shortcutId: string) {
  return () => {
    const now = Date.now();
    const lastClick = clickDebounceMap.get(shortcutId) || 0;

    if (now - lastClick < 300) {
      return;
    }
    clickDebounceMap.set(shortcutId, now);

    const element = document.querySelector(
      `[data-shortcut-id='${shortcutId}']`,
    ) as HTMLElement | null;

    element?.click();
  };
}
