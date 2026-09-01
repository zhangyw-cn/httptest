import { useEffect, useState } from "react";
import { getWorkspace } from "./api";
import type { RequestMeta } from "./types";

export default function App() {
  const [requests, setRequests] = useState<RequestMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ws = await getWorkspace();
        if (!cancelled) {
          setRequests(ws.requests ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <h1>httptest</h1>
      {loading && <p>Loading workspace…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && (
        <ul>
          {requests.map((r) => (
            <li key={r.path}>
              {r.path}
              {r.name ? ` — ${r.name}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
