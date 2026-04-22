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

export type CitationSource = {
  index: number;
  page_number: number | null;
  file_name: string | null;
  content: string;
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
  assistant_sources: CitationSource[];
};

export type SummaryResponse = { document_id: string; summary: string };
export type Bookmark = {
  id: string;
  message_id: string;
  session_id: string;
  session_title: string;
  document_ids: string[];
  document_names: string[];
  snippet: string;
  created_at: string;
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
  return uploadDocumentWithProgress(file);
}

export async function uploadDocumentWithProgress(
  file: File,
  onProgress?: (percent: number) => void
): Promise<Document> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  return new Promise<Document>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/documents/upload`);
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (!event.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(pct);
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as Document;
          if (onProgress) onProgress(100);
          resolve(data);
        } catch {
          reject(new Error("Invalid upload response"));
        }
        return;
      }
      try {
        const parsed = JSON.parse(xhr.responseText) as { detail?: string };
        reject(new Error(parsed?.detail || xhr.statusText || "Upload failed"));
      } catch {
        reject(new Error(xhr.statusText || "Upload failed"));
      }
    };
    xhr.send(form);
  });
}

/** Fetch preview bytes (auth). DOCX uses converted PDF when available. */
export async function fetchDocumentFile(documentId: string): Promise<Blob> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API}/documents/${documentId}/preview`, { headers });
  if (!res.ok) throw new Error(await parseError(res));
  return res.blob();
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

export async function editChatMessage(messageId: string, message: string): Promise<ChatSendResponse> {
  return api<ChatSendResponse>(`/chat/messages/${encodeURIComponent(messageId)}`, {
    method: "PATCH",
    body: JSON.stringify({ message }),
  });
}

export async function renameChatSession(sessionId: string, title: string): Promise<ChatSession> {
  return api<ChatSession>(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  return api<void>(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
}

export async function listBookmarks(limit = 100): Promise<Bookmark[]> {
  return api<Bookmark[]>(`/bookmarks?limit=${encodeURIComponent(String(limit))}`);
}

export async function listBookmarkedMessageIds(sessionId?: string): Promise<string[]> {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return api<string[]>(`/bookmarks/message-ids${qs}`);
}

export async function createBookmark(messageId: string): Promise<Bookmark> {
  return api<Bookmark>("/bookmarks", {
    method: "POST",
    body: JSON.stringify({ message_id: messageId }),
  });
}

export async function deleteBookmarkByMessage(messageId: string): Promise<void> {
  return api<void>(`/bookmarks/by-message/${encodeURIComponent(messageId)}`, {
    method: "DELETE",
  });
}

export { API };
