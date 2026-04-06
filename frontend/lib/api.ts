import { getToken } from "./auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function parseError(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  if (data?.detail) {
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail))
      return data.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join(", ");
  }
  return res.statusText || "Request failed";
}

export type User = { id: string; email: string };

export type Document = {
  id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  text_preview: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export type ChatSession = {
  id: string;
  title: string;
  document_ids: string[];
  created_at: string;
};

export type ChatSendResponse = {
  session_id: string;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export type SummaryResponse = { document_id: string; summary: string };

export type CompareResponse = {
  document_a_title: string;
  document_b_title: string;
  analysis: string;
};

type Opts = RequestInit & { token?: string | null };

export async function api<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  const token = opts.token ?? getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    opts.body &&
    typeof opts.body === "string" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function uploadDocument(file: File): Promise<Document> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API}/documents/upload`, { method: "POST", body: form, headers });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function downloadBlob(pathWithQuery: string, filename: string): Promise<void> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API}${pathWithQuery}`, { headers });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { API };
