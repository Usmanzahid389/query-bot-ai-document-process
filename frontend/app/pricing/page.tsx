"use client";
import Link from "next/link";
import { Check, Zap, Shield, Building2, ArrowRight, Star } from "lucide-react";

const manrope = { className: "" };
const inter = { className: "" };

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for individuals exploring AI document Q&A.",
    icon: <Zap className="h-6 w-6" />,
    accent: "bg-slate-100 text-slate-700",
    cardClass: "bg-white border border-slate-200",
    btnClass: "bg-slate-900 text-white hover:bg-slate-800",
    features: [
      "5 documents / month",
      "10 MB file size limit",
      "Basic chat (20 messages/day)",
      "PDF & TXT support",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    desc: "For professionals who need speed and volume.",
    icon: <Star className="h-6 w-6" />,
    accent: "bg-[#0C2C55] text-white",
    cardClass: "bg-gradient-to-br from-[#0C2C55] to-[#10386a] text-white shadow-2xl scale-105",
    btnClass: "bg-white text-[#0C2C55] hover:bg-slate-100",
    badge: "Most Popular",
    features: [
      "Unlimited documents",
      "100 MB file size limit",
      "Unlimited chat messages",
      "PDF, Word, TXT & more",
      "Smart document search",
      "Export (PDF, Word, Markdown)",
      "Priority email support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "contact us",
    desc: "Built for teams and organizations at scale.",
    icon: <Building2 className="h-6 w-6" />,
    accent: "bg-slate-100 text-slate-700",
    cardClass: "bg-white border border-slate-200",
    btnClass: "bg-[#0C2C55] text-white hover:bg-[#10386a]",
    features: [
      "Everything in Pro",
      "Unlimited file size",
      "Team workspaces & roles",
      "SSO / SAML integration",
      "Custom AI model config",
      "Dedicated account manager",
      "SLA & compliance support",
    ],
  },
];

const faqs = [
  {
    q: "Can I upgrade or downgrade at any time?",
    a: "Yes. You can switch plans instantly from your account settings. Billing is prorated automatically.",
  },
  {
    q: "What file types are supported?",
    a: "Free supports PDF and TXT. Pro and Enterprise add Word (.docx), Excel, PowerPoint, and more.",
  },
  {
    q: "Is my data secure?",
    a: "All uploads are encrypted in transit and at rest. We never use your documents to train AI models.",
  },
  {
    q: "Is there a free trial for Pro?",
    a: "Yes — new accounts get a 7-day Pro trial automatically. No credit card required.",
  },
];

export default function PricingPage() {
  const isLoggedIn = typeof window !== "undefined" && !!localStorage.getItem("querybot_token");

  return (
    <div className={`${manrope.className} min-h-screen bg-slate-100 text-slate-900`}>
      {/* Hero */}
      <section className="px-5 pb-16 pt-20 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#0C2C55]/15 bg-[#0C2C55]/10 px-4 py-2 text-sm font-semibold text-[#0C2C55]">
            <Shield className="h-4 w-4" />
            Simple, transparent pricing
          </div>
          <h1 className="mb-5 text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Plans for every<br />
            <span className="bg-gradient-to-r from-[#0C2C55] to-[#10386a] bg-clip-text text-transparent">
              scale and team
            </span>
          </h1>
          <p className={`${inter.className} mx-auto max-w-xl text-lg text-slate-600`}>
            Start for free, upgrade when you need more power. No hidden fees, cancel anytime.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="px-5 pb-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative rounded-3xl p-8 ${plan.cardClass} transition hover:-translate-y-1`}>
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-1 text-xs font-bold text-[#0C2C55] shadow-md ring-1 ring-[#0C2C55]/20">
                  {plan.badge}
                </div>
              )}

              {/* Icon */}
              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${plan.accent}`}>
                {plan.icon}
              </div>

              <h2 className={`${manrope.className} text-2xl font-extrabold`}>{plan.name}</h2>
              <div className="my-3 flex items-end gap-1">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className={`mb-1 text-sm ${plan.cardClass.includes("gradient") ? "text-blue-100/70" : "text-slate-500"}`}>
                  / {plan.period}
                </span>
              </div>
              <p className={`mb-6 text-sm ${plan.cardClass.includes("gradient") ? "text-blue-100/80" : "text-slate-500"}`}>
                {plan.desc}
              </p>

              <ul className="mb-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className={`h-4 w-4 shrink-0 ${plan.cardClass.includes("gradient") ? "text-white" : "text-[#0C2C55]"}`} />
                    <span className={plan.cardClass.includes("gradient") ? "text-blue-50" : "text-slate-700"}>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.name === "Free" ? (
                <Link
                  href={isLoggedIn ? "/documents" : "/register"}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold transition ${plan.btnClass}`}
                >
                  {isLoggedIn ? "Go to Dashboard" : "Get Started"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-slate-300 py-3 text-sm font-bold text-slate-600 opacity-80"
                >
                  {plan.name === "Pro" ? "Coming Soon" : "Contact Sales"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className={`${manrope.className} mb-12 text-center text-3xl font-bold text-slate-900`}>
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <p className={`${manrope.className} mb-2 font-bold text-slate-900`}>{faq.q}</p>
                <p className={`${inter.className} text-sm text-slate-600`}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#0C2C55] to-[#10386a] p-12 text-center text-white shadow-2xl">
          <h2 className={`${manrope.className} mb-4 text-3xl font-extrabold`}>Ready to get started?</h2>
          <p className={`${inter.className} mb-8 text-blue-100/80`}>
            Join thousands of professionals already using QueryBot.
          </p>
          <Link
            href={isLoggedIn ? "/documents" : "/register"}
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 font-bold text-[#0C2C55] transition hover:bg-slate-100"
          >
            {isLoggedIn ? "Go to Dashboard" : "Start for Free"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
