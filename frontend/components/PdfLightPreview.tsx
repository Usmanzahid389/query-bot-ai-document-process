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
};

export function PdfLightPreview({ fileData, showToolbar = true }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  const [docError, setDocError] = useState<string | null>(null);
  /** Overlay stays until first canvas page paints — avoids skeleton→PDF flicker. */
  const [skeletonOverlay, setSkeletonOverlay] = useState(true);
  const firstPagePainted = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(640);
  const pdfFile = useRef<{ data: Uint8Array } | null>(null);

  if (!pdfFile.current || pdfFile.current.data !== fileData) {
    pdfFile.current = { data: fileData };
  }

  useEffect(() => {
    setNumPages(0);
    setDocError(null);
    setSkeletonOverlay(true);
    firstPagePainted.current = false;
  }, [fileData]);

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
    </div>
  );
}
