"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/** Shown while the file blob is downloading or PDF.js is parsing the document. */
export function PdfPreviewSkeleton({ pageWidth }: { pageWidth?: number }) {
  const w = pageWidth ? Math.max(280, Math.min(pageWidth, 920)) : undefined;
  const minH = w ? Math.round(w * 1.32) : 420;
  return (
    <div className="flex h-full min-h-[400px] flex-col bg-slate-100 dark:bg-zinc-900/50">
      <div className="flex h-[52px] animate-pulse items-center gap-3 border-b border-slate-200 bg-white px-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200/90 dark:bg-zinc-700" />
        <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200/90 dark:bg-zinc-700" />
        <div className="h-4 w-28 shrink-0 rounded bg-slate-200 dark:bg-zinc-700" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200/90 dark:bg-zinc-700" />
          <div className="h-4 w-10 shrink-0 rounded bg-slate-200 dark:bg-zinc-700" />
          <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-200/90 dark:bg-zinc-700" />
        </div>
      </div>
      <div className="flex flex-1 justify-center px-3 py-6">
        <div
          className="w-full max-w-[920px] space-y-3 rounded-lg border border-slate-200/80 bg-white p-6 shadow-md animate-pulse dark:border-zinc-700 dark:bg-zinc-950"
          style={w ? { width: w, minHeight: minH } : { minHeight: minH }}
        >
          <div className="h-3 w-3/5 rounded bg-slate-200 dark:bg-zinc-700" />
          <div className="h-3 w-full rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-3 w-full rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-3 w-[92%] rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-3 w-full rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-3 w-4/5 rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-3 w-full rounded bg-slate-100 dark:bg-zinc-800" />
          <div className="h-3 w-2/3 rounded bg-slate-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  );
}

type Props = {
  fileData: Uint8Array;
  showToolbar?: boolean;
  activeCitation?: { pageNumber: number; snippet: string; timestamp: number } | null;
};

export function PdfLightPreview({ fileData, showToolbar = true, activeCitation = null }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [docError, setDocError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Overlay stays until first canvas page paints — avoids skeleton→PDF flicker. */
  const [skeletonOverlay, setSkeletonOverlay] = useState(true);
  const firstPagePainted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(640);
  const pdfFile = useRef<{ data: Uint8Array } | null>(null);
  const pendingCitationRef = useRef<{ pageNumber: number; snippet: string; timestamp: number } | null>(null);
  const searchPluginInstance = useRef<{ highlight: (snippet: string, pageEl: HTMLElement) => boolean } | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const textLayerObserverRef = useRef<MutationObserver | null>(null);

  const normalizeForSearch = useCallback((value: string) => {
    return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }, []);

  const clearAllHighlights = useCallback(() => {
    const highlighted = Array.from(document.querySelectorAll<HTMLSpanElement>(".qb-citation-highlight"));
    highlighted.forEach((span) => {
      span.classList.remove("qb-citation-highlight");
      span.style.backgroundColor = "";
      span.style.borderRadius = "";
      span.style.padding = "";
    });
  }, []);

  const clearPageHighlights = useCallback((pageEl: HTMLElement) => {
    const spans = Array.from(pageEl.querySelectorAll<HTMLSpanElement>(".react-pdf__Page__textContent span"));
    spans.forEach((span) => {
      span.classList.remove("qb-citation-highlight");
      span.style.backgroundColor = "";
      span.style.borderRadius = "";
      span.style.padding = "";
    });
  }, []);

  const applyFuzzyHighlight = useCallback(
    (rawSnippet: string, pageEl: HTMLElement) => {
      clearAllHighlights();
      clearPageHighlights(pageEl);
      const spans = Array.from(pageEl.querySelectorAll<HTMLSpanElement>(".react-pdf__Page__textContent span"));
      if (!spans.length) return false;

      const normalizeWithSpaces = (value: string) =>
        (value || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const normalizedSnippet = normalizeWithSpaces(rawSnippet);
      if (!normalizedSnippet) return false;
      const snippetWords = normalizedSnippet.split(" ").filter(Boolean);
      const firstFiveWords = snippetWords.slice(0, 5).join(" ");
      const firstFourWords = snippetWords.slice(0, 4).join(" ");
      const firstThreeWords = snippetWords.slice(0, 3).join(" ");
      if (!firstThreeWords) return false;
      const stop = new Set(["the", "and", "for", "with", "from", "into", "this", "that", "are", "was", "were"]);
      const meaningfulWords = snippetWords.filter((w) => w.length >= 4 && !stop.has(w));
      const midStart = Math.max(0, Math.floor(meaningfulWords.length / 2) - 2);
      const midPhrase = meaningfulWords.slice(midStart, midStart + 4).join(" ");
      // Keep candidates specific (>= 3 words) to avoid generic heading matches.
      const phraseCandidates = [firstFiveWords, firstFourWords, firstThreeWords, midPhrase]
        .map((p) => p.trim())
        .filter((p) => p.split(" ").filter(Boolean).length >= 3);

      const applyVisibleHighlight = (span: HTMLSpanElement) => {
        // Bright but still minimalist highlight so it is clearly visible.
        span.classList.add("qb-citation-highlight");
        span.style.backgroundColor = "rgba(250, 204, 21, 0.55)";
        span.style.borderRadius = "2px";
        span.style.padding = "0 1px";
      };

      const normalizedSpanTexts = spans.map((s) => normalizeWithSpaces(s.textContent || ""));
      // Keep explicit spacing between spans so words don't stick together.
      const normalizedPageText = normalizedSpanTexts.join(" ").trim();
      if (!normalizedPageText) return false;

      let usedWindowFind = false;
      let bestStartIdx = -1;
      let matchedCount = 0;
      let finalScore = 0;

      // 1) Exact phrase to spans mapping on normalized page text.
      for (const phrase of phraseCandidates) {
        if (matchedCount > 0) break;
        const occurrences = normalizedPageText.split(phrase).length - 1;
        if (occurrences > 2) continue; // Too generic on this page, skip.
        const idx = normalizedPageText.indexOf(phrase);
        if (idx < 0) continue;
        let cursor = 0;
        const matchedIds: number[] = [];
        for (let i = 0; i < normalizedSpanTexts.length; i++) {
          const t = normalizedSpanTexts[i];
          if (!t) {
            cursor += 1;
            continue;
          }
          const start = cursor;
          const end = cursor + t.length;
          const hitStart = idx;
          const hitEnd = idx + phrase.length;
          if (start < hitEnd && end > hitStart) matchedIds.push(i);
          cursor = end + 1;
        }
        if (matchedIds.length) {
          bestStartIdx = matchedIds[0];
          matchedCount = matchedIds.length;
          finalScore = 1;
          for (const id of matchedIds) applyVisibleHighlight(spans[id]);
        }
      }

      // 2) Safety fallback: token-window score (handles fragmented spans).
      if (matchedCount === 0) {
        const tokens = (firstFiveWords || firstFourWords || firstThreeWords)
          .split(" ")
          .map((t) => t.trim())
          .filter((t) => t.length >= 4 && !stop.has(t));
        let bestIdx = -1;
        let bestTokenScore = 0;
        for (let i = 0; i < normalizedSpanTexts.length; i++) {
          const windowText = normalizedSpanTexts.slice(i, i + 8).join(" ");
          if (!windowText) continue;
          const score = tokens.reduce((acc, t) => acc + (windowText.includes(t) ? 1 : 0), 0);
          if (score > bestTokenScore) {
            bestTokenScore = score;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0 && bestTokenScore > 0) {
          bestStartIdx = bestIdx;
          const end = Math.min(spans.length - 1, bestIdx + 4);
          for (let j = bestIdx; j <= end; j++) applyVisibleHighlight(spans[j]);
          matchedCount = end - bestIdx + 1;
          finalScore = bestTokenScore / Math.max(tokens.length, 1);
        }
      }

      if (matchedCount > 0) {
        console.log(`[Highlight Debug] 
  Snippet: "${normalizedSnippet.substring(0, 30)}..."
  Start Index: ${bestStartIdx}
  Final Similarity: ${finalScore.toFixed(2)}
  Spans Matched: ${matchedCount}
  Fallback Used: ${usedWindowFind}`);
        return true;
      }

      const rect = pageEl.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      const winWithFind = window as Window & { find?: (value: string) => boolean };
      if (inView && typeof winWithFind.find === "function") {
        try {
          for (const phrase of phraseCandidates) {
            if (usedWindowFind) break;
            usedWindowFind = !!winWithFind.find(phrase);
          }
          if (!usedWindowFind) {
            usedWindowFind = !!winWithFind.find(rawSnippet);
          }
          console.log(`[Highlight Debug] 
  Snippet: "${normalizedSnippet.substring(0, 30)}..."
  Start Index: ${bestStartIdx}
  Final Similarity: ${finalScore.toFixed(2)}
  Spans Matched: ${matchedCount}
  Fallback Used: ${usedWindowFind}`);
          return usedWindowFind;
        } catch {
          console.log(`[Highlight Debug] 
  Snippet: "${normalizedSnippet.substring(0, 30)}..."
  Start Index: ${bestStartIdx}
  Final Similarity: ${finalScore.toFixed(2)}
  Spans Matched: ${matchedCount}
  Fallback Used: ${usedWindowFind}`);
          return false;
        }
      }
      console.log(`[Highlight Debug] 
  Snippet: "${normalizedSnippet.substring(0, 30)}..."
  Start Index: ${bestStartIdx}
  Final Similarity: ${finalScore.toFixed(2)}
  Spans Matched: ${matchedCount}
  Fallback Used: ${usedWindowFind}`);
      return false;
    },
    [clearAllHighlights, clearPageHighlights]
  );

  if (!pdfFile.current || pdfFile.current.data !== fileData) {
    pdfFile.current = { data: fileData };
  }

  useEffect(() => {
    setNumPages(0);
    setDocError(null);
    setNotice(null);
    setSkeletonOverlay(true);
    firstPagePainted.current = false;
    pendingCitationRef.current = null;
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
  }, [fileData]);

  useEffect(() => {
    // Plugin-style initialization bridge for highlighting lifecycle.
    searchPluginInstance.current = {
      highlight: (snippet: string, pageEl: HTMLElement) => applyFuzzyHighlight(snippet, pageEl),
    };
    return () => {
      searchPluginInstance.current = null;
    };
  }, [applyFuzzyHighlight]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 40;
      setBaseWidth(Math.max(280, Math.min(w, 920)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onDocLoad = useCallback(({ numPages: n }: { numPages: number }) => {
    setDocError(null);
    setNumPages(n);
  }, []);

  const onFirstPageRendered = useCallback(() => {
    if (firstPagePainted.current) return;
    firstPagePainted.current = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSkeletonOverlay(false);
      });
    });
  }, []);

  /** If the first page never signals render (edge case), do not leave the overlay forever. */
  useEffect(() => {
    if (numPages === 0 || !skeletonOverlay) return undefined;
    const t = window.setTimeout(() => setSkeletonOverlay(false), 8000);
    return () => window.clearTimeout(t);
  }, [numPages, skeletonOverlay, fileData]);

  const width = Math.round(baseWidth * scale);

  const pageLineHeight = Math.round(width * 1.35);

  useEffect(() => {
    if (!activeCitation) return;
    if (numPages <= 0) {
      pendingCitationRef.current = activeCitation;
      setNotice("Loading PDF...");
      return;
    }
    const targetPage = Number(activeCitation.pageNumber) - 1;
    console.log("Final Jump Index:", targetPage);
    if (!Number.isFinite(targetPage) || targetPage < 0 || targetPage >= numPages) {
      setNotice(`Citation page ${activeCitation.pageNumber} is out of range.`);
      return;
    }

    const pageEl = document.querySelector<HTMLElement>(`[data-page-number="${targetPage + 1}"]`);
    if (!pageEl) {
      setNotice("Unable to locate cited page.");
      return;
    }

    pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
    const snippet = (activeCitation.snippet || "").trim().replace(/\s+/g, " ").slice(0, 260);
    console.log("Attemping to highlight:", activeCitation.snippet);
    console.log("Search plugin ready:", !!searchPluginInstance.current);
    if (!snippet) {
      setNotice(null);
      return;
    }
    if (highlightTimerRef.current !== null) {
      window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }
    if (textLayerObserverRef.current) {
      textLayerObserverRef.current.disconnect();
      textLayerObserverRef.current = null;
    }
    let attempts = 0;
    const maxAttempts = 8;
    const tryHighlight = () => {
      attempts += 1;
      const currentPageEl = document.querySelector<HTMLElement>(`[data-page-number="${targetPage + 1}"]`);
      if (!currentPageEl) {
        setNotice("Unable to locate cited page.");
        return;
      }
      const spanCount = currentPageEl.querySelectorAll(".react-pdf__Page__textContent span").length;
      console.log("Highlight attempt", attempts, "spanCount:", spanCount);
      if (spanCount === 0 && attempts < maxAttempts) {
        const textLayer = currentPageEl.querySelector(".react-pdf__Page__textContent");
        if (textLayer && !textLayerObserverRef.current) {
          textLayerObserverRef.current = new MutationObserver(() => {
            const nowCount = currentPageEl.querySelectorAll(".react-pdf__Page__textContent span").length;
            if (nowCount > 0) {
              textLayerObserverRef.current?.disconnect();
              textLayerObserverRef.current = null;
              // Small delay to allow final text layout stabilization.
              highlightTimerRef.current = window.setTimeout(tryHighlight, 80);
            }
          });
          textLayerObserverRef.current.observe(textLayer, { childList: true, subtree: true });
        }
        highlightTimerRef.current = window.setTimeout(tryHighlight, 120);
        return;
      }
      let highlighted = false;
      if (searchPluginInstance.current) {
        highlighted = searchPluginInstance.current.highlight(snippet, currentPageEl);
      }
      if (!highlighted && attempts < maxAttempts) {
        highlightTimerRef.current = window.setTimeout(tryHighlight, 150);
        return;
      }
      if (!highlighted) {
        setNotice("Could not auto-highlight this citation snippet.");
        return;
      }
      setNotice(null);
    };
    tryHighlight();
    return () => {
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
      if (textLayerObserverRef.current) {
        textLayerObserverRef.current.disconnect();
        textLayerObserverRef.current = null;
      }
    };
  }, [activeCitation, numPages]);

  useEffect(() => {
    if (numPages <= 0 || !pendingCitationRef.current) return;
    const pending = pendingCitationRef.current;
    pendingCitationRef.current = null;
    requestAnimationFrame(() => {
      const eventCitation = {
        pageNumber: pending.pageNumber,
        snippet: pending.snippet,
        timestamp: pending.timestamp,
      };
      // Trigger useEffect path using same logic without mutating parent state.
      const targetPage = Number(eventCitation.pageNumber) - 1;
      console.log("Final Jump Index:", targetPage);
      if (Number.isFinite(targetPage) && targetPage >= 0 && targetPage < numPages) {
        const pageEl = document.querySelector<HTMLElement>(`[data-page-number="${targetPage + 1}"]`);
        pageEl?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setNotice(null);
    });
  }, [numPages]);

  return (
    <div className="flex h-full min-h-[400px] flex-col bg-slate-100 dark:bg-zinc-900/50">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
            <span>
              {numPages > 0 ? (
                <>
                  <span className="font-medium text-slate-900 dark:text-white">{numPages}</span> pages · scroll
                </>
              ) : (
                <span className="text-slate-400 dark:text-zinc-500">Opening…</span>
              )}
            </span>
          </div>
          <span className="hidden h-4 w-px bg-slate-200 sm:inline dark:bg-zinc-600" />
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => setScale((s) => Math.max(0.6, Math.round((s - 0.15) * 100) / 100))}
              className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <span className="min-w-[3rem] text-center text-xs font-medium text-slate-500 dark:text-zinc-400">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => setScale((s) => Math.min(2.2, Math.round((s + 0.15) * 100) / 100))}
              className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto bg-slate-100 dark:bg-zinc-900/50">
        <div
          className={`flex flex-col items-center gap-5 px-3 py-6 transition-opacity duration-500 ease-out ${
            skeletonOverlay ? "opacity-0" : "opacity-100"
          }`}
        >
          <Document
            file={pdfFile.current}
            onLoadSuccess={onDocLoad}
            onLoadError={(err) => {
              setDocError(err.message || "Could not open this PDF");
              setSkeletonOverlay(false);
            }}
          >
            {!docError &&
              numPages > 0 &&
              Array.from({ length: numPages }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <div
                    key={`pdf-page-${pageNum}-${width}`}
                    data-page-number={pageNum}
                    className="rounded-lg border border-slate-200/80 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <Page
                      pageNumber={pageNum}
                      width={width}
                      renderTextLayer
                      renderAnnotationLayer
                      onRenderSuccess={pageNum === 1 ? onFirstPageRendered : undefined}
                      loading={
                        <div
                          className="flex items-center justify-center bg-white dark:bg-zinc-950"
                          style={{ width, minHeight: pageLineHeight }}
                          aria-hidden
                        >
                          <div className="mx-4 w-full max-w-sm space-y-2 rounded-md bg-slate-50 p-4 dark:bg-zinc-900">
                            <div className="h-2 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-zinc-700" />
                            <div className="h-2 w-full animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
                            <div className="h-2 w-full animate-pulse rounded bg-slate-100 dark:bg-zinc-800" />
                          </div>
                        </div>
                      }
                    />
                  </div>
                );
              })}
          </Document>
        </div>

        <div
          className={`pointer-events-none absolute inset-0 z-10 overflow-hidden bg-slate-100 transition-opacity duration-500 ease-out dark:bg-zinc-900/50 ${
            skeletonOverlay ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden={!skeletonOverlay}
        >
          <div className="h-full min-h-[320px]">
            <PdfPreviewSkeleton pageWidth={baseWidth} />
          </div>
        </div>
      </div>

      {docError && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {docError}
        </p>
      )}
      {!docError && notice && (
        <p className="border-t border-slate-200 bg-white/90 px-4 py-2 text-xs text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
          {notice}
        </p>
      )}
    </div>
  );
}
