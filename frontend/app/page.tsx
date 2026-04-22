"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Inter, Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

const features = [
  {
    title: "Document Intelligence",
    desc: "Extract structured insights from unstructured text with semantic understanding.",
    accent: "bg-[#0C2C55]/10 text-[#0C2C55]",
    cta: "See extraction quality",
    ctaNote: "Entities, key points, and intent confidence from a single pass.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v3m0 12v3M4.9 4.9l2.1 2.1m9.9 9.9 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m9.9-9.9 2.1-2.1" />
      </svg>
    ),
  },
  {
    title: "Smart Search (RAG)",
    desc: "Retrieval Augmented Generation keeps answers grounded in your source documents.",
    accent: "bg-[#0C2C55]/10 text-[#0C2C55]",
    cta: "See retrieval flow",
    ctaNote: "Chunk ranking, relevance scoring, and source-grounded responses.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-4.2-4.2" />
      </svg>
    ),
  },
  {
    title: "Chat with Documents",
    desc: "Ask follow-up questions in natural language and get clear, cited responses.",
    accent: "bg-[#0C2C55]/10 text-[#0C2C55]",
    cta: "View sample conversation",
    ctaNote: "Context memory across follow-ups with citation traceability.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 5h16v10H8l-4 4V5Z" />
      </svg>
    ),
  },
  {
    title: "Fast and Secure AI",
    desc: "Enterprise-grade safeguards with low-latency processing for large files.",
    accent: "bg-[#0C2C55]/10 text-[#0C2C55]",
    cta: "Review security highlights",
    ctaNote: "Encryption, access controls, and low-latency processing at scale.",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 5 6v6c0 4.6 2.8 7.8 7 9 4.2-1.2 7-4.4 7-9V6l-7-3Z" />
        <path d="m9.5 12 1.8 1.8 3.7-3.7" />
      </svg>
    ),
  },
];

export default function Home() {
  const [openModal, setOpenModal] = useState<null | "business" | "legal">(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("querybot_token"));
  }, []);

  return (
    <>
    {openModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setOpenModal(null)}>
        <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setOpenModal(null)} className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>

          {openModal === "business" && (
            <>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0C2C55]/10 text-[#0C2C55]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
              <h3 className={`${manrope.className} mb-2 text-2xl font-bold text-slate-900`}>Business Professionals</h3>
              <p className="mb-6 text-sm text-slate-500">Everything you need to turn documents into decisions — instantly.</p>
              <ul className="space-y-3">
                {[
                  ["📊", "Quarterly Reports", "Summarize earnings calls and financial statements in under 10 seconds."],
                  ["📁", "Internal Wikis", "Search across department wikis and policy docs with natural language."],
                  ["📈", "Market Research", "Extract competitor insights and trend signals from lengthy PDF reports."],
                  ["🔗", "Cross-Document Links", "Automatically surface related insights across multiple uploaded files."],
                ].map(([icon, title, desc]) => (
                  <li key={title} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className={`${manrope.className} text-sm font-bold text-slate-900`}>{title}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link href={isLoggedIn ? "/documents" : "/register"} className="mt-6 block w-full rounded-2xl bg-gradient-to-r from-[#0C2C55] to-[#10386a] py-3 text-center text-sm font-bold text-white transition hover:opacity-90">{isLoggedIn ? "Go to Dashboard" : "Get Started Free"}</Link>
            </>
          )}

          {openModal === "legal" && (
            <>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/10 text-slate-900">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <h3 className={`${manrope.className} mb-2 text-2xl font-bold text-slate-900`}>Legal Teams</h3>
              <p className="mb-6 text-sm text-slate-500">See how top legal teams cut document review time by up to 70%.</p>
              <ul className="space-y-3">
                {[
                  ["⚖️", "Contract Review", "Instantly identify key clauses, obligations, and red flags in contracts."],
                  ["📜", "Case Law Research", "Cross-reference thousands of cases and precedents in seconds."],
                  ["✅", "Compliance Checks", "Verify documents against regulatory standards automatically."],
                  ["🔒", "Secure & Private", "All documents processed with enterprise-grade encryption and access controls."],
                ].map(([icon, title, desc]) => (
                  <li key={title} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <p className={`${manrope.className} text-sm font-bold text-slate-900`}>{title}</p>
                      <p className="text-xs text-slate-500">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="mt-6 block w-full rounded-2xl bg-slate-900 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800">View Pricing</Link>
            </>
          )}
        </div>
      </div>
    )}
    <div className={`${manrope.className} w-full overflow-x-hidden bg-slate-100 text-slate-900`}>
      <main className={inter.className}>
        <section className="relative overflow-hidden px-5 pb-28 pt-8 sm:px-6 sm:pt-12 lg:px-4 xl:px-6">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-28 -top-24 h-96 w-96 rounded-full bg-[#0C2C55]/15 blur-3xl" />
            <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[#0C2C55]/10 blur-3xl" />
          </div>

          <div className="mx-auto grid w-full max-w-[90rem] items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div className="animate-[fadeIn_.55s_ease-out] text-center lg:text-left">
              <div className="mb-8 inline-flex items-center rounded-full border border-[#0C2C55]/15 bg-[#0C2C55]/10 px-4 py-2 text-sm font-semibold text-[#0C2C55]">
                Powered by GPT-4 and Claude 3
              </div>
              <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl xl:text-7xl">
                Smart Query Bot for Your{" "}
                <span className="bg-gradient-to-r from-[#0C2C55] to-[#10386a] bg-clip-text text-transparent">Documents</span>
              </h1>
              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-600 lg:mx-0 lg:text-xl">
                AI document Q and A for PDF, Word, and text files. Upload your knowledge base and start getting
                instant, cited answers.
              </p>
              <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
                <Link
                  href={isLoggedIn ? "/documents" : "/register"}
                  className="rounded-2xl bg-gradient-to-r from-[#0C2C55] to-[#10386a] px-8 py-4 text-base font-bold text-white shadow-lg transition hover:opacity-90"
                >
                  {isLoggedIn ? "Open Dashboard" : "Get Started for Free"}
                </Link>
              </div>
            </div>

            <div className="animate-[fadeIn_.7s_ease-out]">
              <div className="rounded-3xl p-1 shadow-2xl">
                <div className="overflow-hidden rounded-2xl">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDC_9XP9P95DkaT0uJ0TXDDJuuzDVD_mgbCsgiPBk_vKXKy9eLI2LBXR9KHuMJLUT_mDj-4CFubmV5A2yf2_3QkP4vfOBcY4ryvUvyGzAhc_c3CTIPrvLQ_LA31rWsnbkbf_sjb76eWvIlSTTbFi2Pi-2zEwovDKMPr3-aS2UbYfpB5wL_XNLRUM7hAqonZ9dmD1jyNcFbrhxFaeL5JUrNcqYR7gkMlZstv8hUtR4bsNXpJPCB-tEzerfq4GaH_Askuqiu6jga8gQZ4"
                    alt="QueryBot dashboard preview"
                    className="h-[280px] w-full rounded-2xl object-cover sm:h-[340px] lg:h-[400px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-100 px-5 py-24 sm:px-6 lg:px-4 xl:px-6">
          <div className="mx-auto max-w-[90rem]">
            <div className="mb-14 text-center">
              <h2 className={`${manrope.className} mb-4 text-4xl font-bold text-slate-900`}>Precision Intelligence</h2>
              <p className="text-slate-600">Advanced document processing meets intuitive conversation.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature, i) => (
                <article
                  key={feature.title}
                  className="group animate-[fadeIn_.8s_ease-out] relative overflow-hidden rounded-2xl bg-gradient-to-b from-white to-slate-50 p-7 text-left shadow-[0_10px_28px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(12,44,85,0.16)] hover:ring-[#0C2C55]/25"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#0C2C55]/5 blur-2xl transition duration-300 group-hover:bg-[#0C2C55]/10" />
                  <div className={`relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ring-inset ring-[#0C2C55]/10 transition duration-300 group-hover:scale-105 ${feature.accent}`}>{feature.icon}</div>
                  <h3 className={`${manrope.className} mb-2 text-xl font-bold text-slate-900`}>{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{feature.desc}</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#0C2C55] opacity-80 transition duration-300 group-hover:opacity-100">
                    {feature.cta}
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{feature.ctaNote}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-100 px-5 py-24 sm:px-6 lg:px-4 xl:px-6">
          <div className="mx-auto grid max-w-[90rem] items-center gap-14 lg:grid-cols-2">
            <div>
              <h2 className={`${manrope.className} mb-8 text-5xl font-extrabold leading-tight`}>
                Simplify Your <br />
                <span className="text-[#0C2C55]">Knowledge Flow</span>
              </h2>
              <div className="space-y-4">
                {["Upload", "Chunking and Embeddings", "AI Answer"].map((step, idx) => (
                  <div key={step} className="flex items-start gap-4 rounded-2xl bg-white/75 p-4 shadow-sm ring-1 ring-slate-200/70">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0C2C55] text-sm font-bold text-white shadow-sm">
                        {idx + 1}
                      </div>
                      {idx < 2 ? <div className="mt-2 h-10 w-px bg-[#0C2C55]/25" /> : null}
                    </div>
                    <div>
                      <h4 className={`${manrope.className} mb-1 text-lg font-bold text-slate-900`}>{step}</h4>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {idx === 0 && "Drag and drop PDFs, Docs, or text files securely."}
                        {idx === 1 && "AI parses context at paragraph level for semantic retrieval."}
                        {idx === 2 && "Ask naturally and get instant answers backed by sources."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-[#0C2C55]/10 to-slate-200 p-8 lg:mt-36">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                <div className="mb-5 flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-3/4 rounded-full bg-slate-200" />
                  <div className="h-4 w-full rounded-full bg-slate-200" />
                  <div className="h-4 w-1/2 rounded-full bg-slate-200" />
                  <div className="flex h-20 items-center justify-center rounded-xl bg-[#0C2C55]/10 text-sm font-bold tracking-wide text-[#0C2C55]">
                    AI ANALYZING...
                  </div>
                  <div className="h-4 w-5/6 rounded-full bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-100 px-5 py-24 sm:px-6 lg:px-4 xl:px-6">
          <div className="mx-auto max-w-[90rem]">
            <div className="mb-14 text-center">
              <h2 className={`${manrope.className} mb-3 text-4xl font-bold text-slate-900`}>Tailored for Every Workflow</h2>
              <p className="text-slate-600">Powerful AI tools built for the way you work.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {/* Business Professionals — wide featured card */}
              <article className="group relative md:col-span-2 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0C2C55] to-[#10386a] p-8 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
                <div className="absolute bottom-0 right-0 h-32 w-32 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 uppercase tracking-widest">
                    Most Popular
                  </div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-white">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  </div>
                  <h3 className={`${manrope.className} mb-2 text-2xl font-bold text-white`}>Business Professionals</h3>
                  <p className="mb-6 text-blue-100/80">Analyze market reports, quarterly results, and internal wikis in seconds. Get boardroom-ready insights instantly.</p>
                  <button onClick={() => setOpenModal("business")} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white transition group-hover:bg-white/25">
                    Learn More
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </article>

              {/* Legal Teams */}
              <article className="group relative overflow-hidden rounded-3xl bg-slate-900 p-8 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/5" />
                <div className="relative z-10">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"/>
                    </svg>
                  </div>
                  <h3 className={`${manrope.className} mb-2 text-2xl font-bold text-white`}>Legal Teams</h3>
                  <p className="mb-6 text-slate-400">Process contracts, case laws, and compliance docs with precision and speed.</p>
                  <button onClick={() => setOpenModal("legal")} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition group-hover:bg-white/20">
                    Case Studies
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </article>

              {/* Researchers */}
              <article className="group rounded-3xl bg-white p-8 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0C2C55]/10 text-[#0C2C55]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="11" cy="11" r="6"/><path d="m20 20-4.2-4.2"/>
                  </svg>
                </div>
                <h3 className={`${manrope.className} mb-2 text-xl font-bold text-slate-900`}>Researchers</h3>
                <p className="text-sm text-slate-600">Summarize dense papers and detect cross-references automatically.</p>
              </article>

              {/* Students */}
              <article className="group rounded-3xl bg-white p-8 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0C2C55]/10 text-[#0C2C55]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                </div>
                <h3 className={`${manrope.className} mb-2 text-xl font-bold text-slate-900`}>Students</h3>
                <p className="text-sm text-slate-600">Convert study material into interactive learning conversations.</p>
              </article>

              {/* Developers */}
              <article className="group rounded-3xl bg-white p-8 shadow-md transition hover:-translate-y-1 hover:shadow-xl">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0C2C55]/10 text-[#0C2C55]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                  </svg>
                </div>
                <h3 className={`${manrope.className} mb-2 text-xl font-bold text-slate-900`}>Developers</h3>
                <p className="text-sm text-slate-600">Query API docs and technical specs through natural language prompts.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-5 py-24 sm:px-6 lg:px-4 xl:px-6">
          <div className="mx-auto max-w-[90rem]">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0C2C55] to-[#10386a] p-10 text-center text-white md:p-16">
              <div className="absolute inset-0 opacity-15 [background:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />
              <div className="relative z-10">
                <h2 className={`${manrope.className} mb-5 text-4xl font-extrabold md:text-5xl`}>
                  Start using AI to explore your documents
                </h2>
                <p className="mx-auto mb-8 max-w-2xl text-slate-200">
                  Join thousands of professionals saving hours of reading time every week.
                </p>
                <div className="flex flex-col justify-center gap-4 sm:flex-row">
                  <Link
                    href={isLoggedIn ? "/documents" : "/register"}
                    className="rounded-full bg-white px-10 py-4 text-lg font-bold text-[#0C2C55] transition hover:bg-slate-100"
                  >
                    {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-5 pb-6 pt-12 sm:px-6 lg:px-4 xl:px-6">
        <div className="mx-auto grid max-w-[90rem] grid-cols-1 gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <h4 className={`${manrope.className} text-lg font-bold text-slate-900`}>QueryBot</h4>
            <p className={`${inter.className} text-sm text-slate-600`}>
              The next generation of document intelligence. Built for humans, powered by AI.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className={`${manrope.className} font-bold text-slate-900`}>Company</h5>
            <p className="text-sm text-slate-600">About Us</p>
            <p className="text-sm text-slate-600">Careers</p>
            <p className="text-sm text-slate-600">Press</p>
          </div>
          <div className="space-y-2">
            <h5 className={`${manrope.className} font-bold text-slate-900`}>Product</h5>
            <p className="text-sm text-slate-600">Pricing</p>
            <p className="text-sm text-slate-600">API</p>
            <p className="text-sm text-slate-600">Security</p>
          </div>
          <div className="space-y-2">
            <h5 className={`${manrope.className} font-bold text-slate-900`}>Legal</h5>
            <p className="text-sm text-slate-600">Privacy Policy</p>
            <p className="text-sm text-slate-600">Terms of Service</p>
            <p className="text-sm text-slate-600">Cookie Settings</p>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-[90rem] border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
          © 2026 QueryBot AI. All rights reserved.
        </div>
      </footer>
    </div>
    </>
  );
}
