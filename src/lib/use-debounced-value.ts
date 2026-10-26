"use client";

import { useEffect, useState } from "react";

/**
 * Debounces a value. Used for search boxes so a keystroke doesn't fire a request
 * per character against the admin API.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
