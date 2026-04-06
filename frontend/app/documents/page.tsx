"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, uploadDocument, type Document } from "@/lib/api";
import { RequireAuth } from "@/components/RequireAuth";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await api<Document[]>("/documents");
      setDocs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDocument(file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    await handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files?.[0];
    void handleFile(file);
  }

  return (
    <RequireAuth>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Documents</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Upload PDF, DOCX, or TXT up to 10 MB. Then open a document to chat or generate a summary.
          </p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`rounded-lg border border-dashed bg-white p-6 dark:bg-zinc-900/40 ${
            drag ? "border-zinc-500 bg-zinc-50 dark:border-zinc-500 dark:bg-zinc-800/50" : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          <label className="flex cursor-pointer flex-col items-center gap-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {uploading ? "Uploading…" : "Click to upload or drop files (single file)"}
            </span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              disabled={uploading}
              onChange={onFile}
            />
            <span className="text-xs text-zinc-500">.pdf, .docx, .txt</span>
          </label>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Your files</h2>
          {docs.length === 0 ? (
            <p className="text-sm text-zinc-500">No documents yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40">
              {docs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <Link
                      href={`/documents/${d.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {d.original_filename}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {(d.size_bytes / 1024).toFixed(1)} KB · {new Date(d.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    href={`/documents/${d.id}`}
                    className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
                  >
                    Open chat
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </RequireAuth>
  );
}
