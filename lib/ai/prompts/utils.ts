/**
 * Strip null, undefined, empty strings, empty arrays, and empty objects
 * from a state object before sending it to an AI prompt.
 * Recursively compacts nested objects and array items.
 */
export function compactStateForPrompt(state: object): object {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(state)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' ? compactStateForPrompt(item as object) : item
      );
      continue;
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const nested = compactStateForPrompt(value as object);
      if (Object.keys(nested).length === 0) continue;
      result[key] = nested;
    } else {
      result[key] = value;
    }
  }
  return result;
}
