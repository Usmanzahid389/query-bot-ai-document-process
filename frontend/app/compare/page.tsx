"use client";

import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, type CompareResponse, type Document } from "@/lib/api";

export default function ComparePage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Document[]>("/documents")
      .then(setDocs)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load documents"));
  }, []);

  async function onCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!a || !b || a === b) {
      setError("Pick two different documents.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<CompareResponse>("/chat/compare", {
        method: "POST",
        body: JSON.stringify({ document_id_a: a, document_id_b: b }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Compare failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Compare documents</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Select two uploaded files. The backend returns a mock side-by-side style analysis for MVP.
          </p>
        </div>

        <form onSubmit={onCompare} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Document A</label>
              <select
                value={a}
                onChange={(e) => setA(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              >
                <option value="">Select…</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.original_filename}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Document B</label>
              <select
                value={b}
                onChange={(e) => setB(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                required
              >
                <option value="">Select…</option>
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.original_filename}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </form>

        {result && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.document_a_title}</h2>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{result.document_b_title}</h2>
            </div>
            <div className="md:col-span-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100">Mock analysis</h3>
              <div className="mt-2 whitespace-pre-wrap">{result.analysis}</div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
