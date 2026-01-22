// Minimal neutral transport API shim
// Purpose: replace imports of textsecure/WebAPI.preload.ts (and similar Signal WebAPI modules)
// with a neutral interface while you implement the Tor-backed transport backend.
// The implementations intentionally throw clear errors so you can find code paths
// that still depend on server behavior and implement them on the Tor transport.

export type TransportOptions = {
  proxyUrl?: string; // optional Tor proxy url (e.g. socks5h://127.0.0.1:9050)
};

export type TransportRequest = {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  options?: TransportOptions;
};

export type TransportResponse<T = unknown> = {
  status: number;
  body?: T;
  headers?: Record<string, string>;
};

export async function isOnline(): Promise<boolean> {
  // Return false until transport is implemented.
  // Replace with a real connectivity check (e.g. test Tor hidden service reachability).
  return false;
}

export async function request<T = unknown>(req: TransportRequest): Promise<TransportResponse<T>> {
  throw new Error(
    `TransportAPI.request not implemented (requested ${req.method ?? 'GET'} ${req.path}). ` +
      `Implement a Tor-backed transport and replace this shim.`
  );
}

export async function get<T = unknown>(path: string, options?: TransportOptions): Promise<TransportResponse<T>> {
  return request<T>({ path, method: 'GET', options });
}

export async function post<T = unknown>(path: string, body?: unknown, options?: TransportOptions): Promise<TransportResponse<T>> {
  return request<T>({ path, method: 'POST', body, options });
}

// Add more helpers (put/delete, cdsLookup, etc.) as you implement the Tor backend.
export default {
  isOnline,
  request,
  get,
  post,
};
