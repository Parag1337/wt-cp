"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminApiError, type Pagination } from "../../lib/admin-api";

export type UseAdminQueryResult<T> = {
  status: "loading" | "ready" | "error";
  data: T | null;
  pagination: Pagination | null;
  error: AdminApiError | null;
  /** True while a refresh re-fetches the current view (previous data stays visible). */
  refreshing: boolean;
  reload: () => void;
  /** Replaces the current data with a server response (e.g. after a mutation). */
  setData: (data: T) => void;
};

function toAdminError(error: unknown): AdminApiError {
  if (error instanceof AdminApiError) return error;
  return new AdminApiError(
    error instanceof Error ? error.message : "Something went wrong. Please try again.",
    0
  );
}

/**
 * Runs an admin API loader and exposes loading / ready / error states.
 *
 * - `deps` controls re-fetching (filters, page, …).
 * - `reload()` refreshes in place without dropping the current data.
 * - Aborts the in-flight request when deps change or the component unmounts.
 */
export function useAdminQuery<T>(
  loader: (signal: AbortSignal) => Promise<{ data: T; pagination?: Pagination }>,
  deps: readonly unknown[]
): UseAdminQueryResult<T> {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    data: T | null;
    pagination: Pagination | null;
    error: AdminApiError | null;
  }>({ status: "loading", data: null, pagination: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Call the loader passed for *this* run. Reading a ref updated by an effect
    // would risk using the previous render's loader (and it isn't needed here).
    loader(controller.signal)
      .then((result) => {
        if (!active) return;
        setState({
          status: "ready",
          data: result.data,
          pagination: result.pagination ?? null,
          error: null,
        });
        setRefreshing(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState((previous) => ({
          status: "error",
          data: previous.data,
          pagination: previous.pagination,
          error: toAdminError(error),
        }));
        setRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // deps is a caller-provided list of primitives; spreading it keeps the
    // dependency count stable between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, ...deps]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  }, []);

  const setData = useCallback((data: T) => {
    setState((previous) => ({ ...previous, status: "ready", data, error: null }));
  }, []);

  return { ...state, refreshing, reload, setData };
}
