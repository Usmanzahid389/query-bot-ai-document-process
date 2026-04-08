import Link from "next/link";
import { Inter, Manrope } from "next/font/google";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"] });

const features = [
  {
    title: "Document Intelligence",
    desc: "Extract structured insights from unstructured text with semantic understanding.",
    accent: "bg-blue-100 text-blue-700",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v3m0 12v3M4.9 4.9l2.1 2.1m9.9 9.9 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m9.9-9.9 2.1-2.1" />
      </svg>
    ),
  },
  {
    title: "Smart Search (RAG)",
    desc: "Retrieval Augmented Generation keeps answers grounded in your source documents.",
    accent: "bg-indigo-100 text-indigo-700",
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
    accent: "bg-fuchsia-100 text-fuchsia-700",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 5h16v10H8l-4 4V5Z" />
      </svg>
    ),
  },
  {
    title: "Fast and Secure AI",
    desc: "Enterprise-grade safeguards with low-latency processing for large files.",
    accent: "bg-emerald-100 text-emerald-700",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 5 6v6c0 4.6 2.8 7.8 7 9 4.2-1.2 7-4.4 7-9V6l-7-3Z" />
        <path d="m9.5 12 1.8 1.8 3.7-3.7" />
      </svg>
    ),
  },
];

export default function Home() {
  return (
    <div className={`${manrope.className} relative left-1/2 w-screen -translate-x-1/2 overflow-x-hidden bg-slate-50 text-slate-900`}>
      <main className={inter.className}>
        <section className="relative overflow-hidden px-6 pb-28 pt-8 sm:px-10 sm:pt-12 lg:px-16">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-28 -top-24 h-96 w-96 rounded-full bg-blue-200/50 blur-3xl" />
            <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
          </div>

          <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <div className="animate-[fadeIn_.55s_ease-out] text-center lg:text-left">
              <div className="mb-8 inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                Powered by GPT-4 and Claude 3
              </div>
              <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl xl:text-7xl">
                Smart Query Bot for Your{" "}
                <span className="bg-gradient-to-r from-blue-700 to-indigo-600 bg-clip-text text-transparent">Documents</span>
              </h1>
              <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-600 lg:mx-0 lg:text-xl">
                AI document Q and A for PDF, Word, and text files. Upload your knowledge base and start getting
                instant, cited answers.
              </p>
              <div className="flex flex-wrap justify-center gap-4 lg:justify-start">
                <Link
                  href="/register"
                  className="rounded-2xl bg-gradient-to-r from-blue-700 to-blue-500 px-8 py-4 text-base font-bold text-white shadow-lg transition hover:opacity-90"
                >
                  Get Started for Free
                </Link>
              </div>
            </div>

            <div className="animate-[fadeIn_.7s_ease-out]">
              <div className="rounded-3xl border border-slate-200 bg-white/75 p-4 shadow-2xl backdrop-blur-xl">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <img
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDC_9XP9P95DkaT0uJ0TXDDJuuzDVD_mgbCsgiPBk_vKXKy9eLI2LBXR9KHuMJLUT_mDj-4CFubmV5A2yf2_3QkP4vfOBcY4ryvUvyGzAhc_c3CTIPrvLQ_LA31rWsnbkbf_sjb76eWvIlSTTbFi2Pi-2zEwovDKMPr3-aS2UbYfpB5wL_XNLRUM7hAqonZ9dmD1jyNcFbrhxFaeL5JUrNcqYR7gkMlZstv8hUtR4bsNXpJPCB-tEzerfq4GaH_Askuqiu6jga8gQZ4"
                    alt="QueryBot dashboard preview"
                    className="h-full w-full rounded-2xl object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-100 px-6 py-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 text-center">
              <h2 className={`${manrope.className} mb-4 text-4xl font-bold text-slate-900`}>Precision Intelligence</h2>
              <p className="text-slate-600">Advanced document processing meets intuitive conversation.</p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
              {features.map((feature, i) => (
                <article
                  key={feature.title}
                  className="animate-[fadeIn_.8s_ease-out] rounded-3xl border border-slate-200 bg-white/80 p-7 shadow-sm backdrop-blur-md transition hover:-translate-y-1"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full ${feature.accent}`}>{feature.icon}</div>
                  <h3 className={`${manrope.className} mb-2 text-xl font-bold text-slate-900`}>{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-50 px-6 py-24 sm:px-10 lg:px-16">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2">
            <div>
              <h2 className={`${manrope.className} mb-8 text-5xl font-extrabold leading-tight`}>
                Simplify Your <br />
                <span className="text-blue-700">Knowledge Flow</span>
              </h2>
              <div className="space-y-9">
                {["Upload", "Chunking and Embeddings", "AI Answer"].map((step, idx) => (
                  <div key={step} className="flex items-start gap-5">
                    <div className="flex flex-col items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
                        {idx + 1}
                      </div>
                      {idx < 2 ? <div className="mt-2 h-12 w-px bg-slate-300" /> : null}
                    </div>
                    <div>
                      <h4 className={`${manrope.className} text-lg font-bold text-slate-900`}>{step}</h4>
                      <p className="text-sm text-slate-600">
                        {idx === 0 && "Drag and drop PDFs, Docs, or text files securely."}
                        {idx === 1 && "AI parses context at paragraph level for semantic retrieval."}
                        {idx === 2 && "Ask naturally and get instant answers backed by sources."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
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
                  <div className="flex h-20 items-center justify-center rounded-xl bg-blue-100 text-sm font-bold tracking-wide text-blue-700">
                    AI ANALYZING...
                  </div>
                  <div className="h-4 w-5/6 rounded-full bg-slate-200" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-slate-100 px-6 py-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 text-center">
              <h2 className={`${manrope.className} text-4xl font-bold`}>Tailored for Every Workflow</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <article className="md:col-span-2 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className={`${manrope.className} mb-2 text-2xl font-bold`}>Business Professionals</h3>
                <p className="mb-5 text-slate-600">Analyze market reports, quarterly results, and internal wikis in seconds.</p>
                <button className="font-semibold text-blue-700 transition hover:text-blue-800">Learn More</button>
              </article>
              <article className="rounded-3xl bg-slate-900 p-8 text-white shadow-sm">
                <h3 className={`${manrope.className} mb-2 text-2xl font-bold`}>Legal Teams</h3>
                <p className="mb-5 text-slate-300">Process contracts, case laws, and compliance docs with precision.</p>
                <button className="font-semibold text-blue-300 transition hover:text-blue-200">Case Studies</button>
              </article>
              <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className={`${manrope.className} mb-2 text-xl font-bold`}>Researchers</h3>
                <p className="text-slate-600">Summarize dense papers and detect cross-references automatically.</p>
              </article>
              <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className={`${manrope.className} mb-2 text-xl font-bold`}>Students</h3>
                <p className="text-slate-600">Convert study material into interactive learning conversations.</p>
              </article>
              <article className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                <h3 className={`${manrope.className} mb-2 text-xl font-bold`}>Developers</h3>
                <p className="text-slate-600">Query API docs and technical specs through natural language prompts.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="px-6 py-24 sm:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 to-indigo-600 p-10 text-center text-white md:p-16">
              <div className="absolute inset-0 opacity-15 [background:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />
              <div className="relative z-10">
                <h2 className={`${manrope.className} mb-5 text-4xl font-extrabold md:text-5xl`}>
                  Start using AI to explore your documents
                </h2>
                <p className="mx-auto mb-8 max-w-2xl text-blue-100">
                  Join thousands of professionals saving hours of reading time every week.
                </p>
                <div className="flex flex-col justify-center gap-4 sm:flex-row">
                  <Link href="/register" className="rounded-full bg-white px-10 py-4 text-lg font-bold text-blue-700 transition hover:bg-blue-50">
                    Get Started Free
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full border border-white/30 bg-white/10 px-10 py-4 text-lg font-bold text-white transition hover:bg-white/20"
                  >
                    Talk to Sales
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-100 px-6 pb-6 pt-12 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 md:grid-cols-4">
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
        <div className="mx-auto mt-8 max-w-7xl border-t border-slate-200 pt-6 text-center text-sm text-slate-500">
          © 2026 QueryBot AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
