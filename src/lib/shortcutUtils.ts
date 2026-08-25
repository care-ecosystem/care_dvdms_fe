/**
 * Expands a context string into all possible hierarchical contexts.
 *
 * @example
 * expandShortcutContext("facility:inventory:delivery")
 * // Returns: ["facility", "facility:inventory", "facility:inventory:delivery"]
 */
export function expandShortcutContext(
  contextKey: string,
  hierarchySeparator = ":",
): string[] {
  if (!contextKey.trim()) {
    return [];
  }

  const normalizedKey = contextKey
    .trim()
    .replace(new RegExp(`${hierarchySeparator}+`, "g"), hierarchySeparator)
    .replace(
      new RegExp(`^${hierarchySeparator}|${hierarchySeparator}$`, "g"),
      "",
    );

  if (!normalizedKey) {
    return [];
  }

  const contextHierarchies = normalizedKey
    .split("&")
    .map((hierarchy) => hierarchy.trim())
    .filter(Boolean);

  const expandedContexts: string[] = [];

  for (const hierarchy of contextHierarchies) {
    const hierarchyParts = hierarchy.split(hierarchySeparator);

    for (let i = 1; i <= hierarchyParts.length; i++) {
      const context = hierarchyParts.slice(0, i).join(hierarchySeparator);
      if (!expandedContexts.includes(context)) {
        expandedContexts.push(context);
      }
    }
  }

  return expandedContexts;
}
