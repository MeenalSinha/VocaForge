/** Browser-side helper for the JSON envelope returned by /api routes. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", "network");
  }
  const body = (await res.json().catch(() => null)) as
    | { data?: T; error?: { code: string; message: string; fieldErrors?: Record<string, string[]> } }
    | null;
  if (!res.ok || !body || body.error) {
    throw new ApiError(body?.error?.message ?? `Request failed (HTTP ${res.status}).`, body?.error?.code ?? "unknown", body?.error?.fieldErrors);
  }
  return body.data as T;
}
