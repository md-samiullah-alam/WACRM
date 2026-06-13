import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Check,
  Clock,
  Crown,
  GitBranch,
  MessageSquare,
  Radio,
  Settings,
  Shield,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "OptiFlow CRM — WhatsApp CRM Platform",
  description:
    "Complete WhatsApp CRM with shared inbox, contacts, pipelines, broadcasts, automations, and flow builder. 5-min free trial. Plans starting at ₹20,000 one-time.",
};

const features = [
  {
    icon: MessageSquare,
    title: "WhatsApp Shared Inbox",
    desc: "Manage all customer conversations in one place. Assign, reply, and track every message effortlessly.",
  },
  {
    icon: Users,
    title: "Contact Management",
    desc: "Organize contacts with tags, custom fields, notes, and detailed profiles. Know your customers better.",
  },
  {
    icon: GitBranch,
    title: "Sales Pipelines & Deals",
    desc: "Track deals through customizable pipeline stages. Drag, drop, and close with confidence.",
  },
  {
    icon: Radio,
    title: "Broadcast Messaging",
    desc: "Send WhatsApp broadcasts to filtered audiences. Schedule campaigns and track delivery in real-time.",
  },
  {
    icon: Zap,
    title: "No-Code Automations",
    desc: "Create powerful automation workflows triggered by messages, keywords, tags, and scheduled events.",
  },
  {
    icon: Workflow,
    title: "Visual Flow Builder",
    desc: "Design conversational flows with a drag-and-drop canvas. Map every customer interaction visually.",
  },
  {
    icon: Settings,
    title: "Message Templates",
    desc: "Create, submit, and manage WhatsApp Business message templates. Pre-approved for instant use.",
  },
  {
    icon: Shield,
    title: "Account Sharing",
    desc: "Invite team members with role-based access — owner, admin, agent, or viewer. Collaborate securely.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* ======================================== */}
      {/* HEADER / NAVBAR */}
      {/* ======================================== */}
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img
              src="https://res.cloudinary.com/ddk4lshru/image/upload/WhatsApp_Image_2026-01-16_at_9.37.23_PM_eqbatz.jpg"
              alt="OptiFlow"
              className="h-9 w-9 rounded-lg object-cover"
            />
            <span className="text-lg font-bold text-white">OptiFlow</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* ======================================== */}
      {/* HERO SECTION */}
      {/* ======================================== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary mb-6">
              <Sparkles className="h-4 w-4" />
              5-Minute Free Trial — No Credit Card Required
            </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto">
            WhatsApp CRM That Works
            <span className="text-primary"> While You Sleep</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto">
            Shared inbox, contacts, pipelines, broadcasts, automations, and
            flow builder — all connected to your WhatsApp Business number.
            Self-hosted, secure, and blazing fast.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Start Free Trial
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-8 py-4 text-base font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-all"
            >
              I Already Have an Account
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            No setup fees. 5-min full access trial. Plans from ₹20,000 one-time.
          </p>
        </div>
      </section>

      {/* ======================================== */}
      {/* FEATURES GRID */}
      {/* ======================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Everything You Need to Run Your Business
          </h2>
          <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
            All these features are available during the 5-min free trial. After
            that, choose the yearly plan to keep access forever.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feat) => (
            <div
              key={feat.title}
              className="group rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-primary/30 hover:bg-slate-900 transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                <feat.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feat.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feat.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================== */}
      {/* PLAN SECTION */}
      {/* ======================================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
            One plan. All features. No hidden costs. Pay once and own it
            forever.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {/* ======================================== */}
          {/* FREE TRIAL CARD */}
          {/* ======================================== */}
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
                <Clock className="h-7 w-7 text-blue-400" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Free Trial
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Try all features free — no credit card required
            </p>

            <div className="mb-6">
              <span className="text-5xl font-extrabold text-white">FREE</span>
              <span className="text-slate-400 text-lg block mt-1">5 minutes</span>
            </div>

            <ul className="space-y-3 text-left mb-8">
              {[
                "All features unlocked",
                "5 minutes full access",
                "No credit card required",
                "Auto-activated on signup",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full rounded-xl bg-blue-500 px-6 py-3.5 text-base font-semibold text-white hover:bg-blue-600 transition-all"
            >
              Start Free Trial
            </Link>
          </div>

          {/* ======================================== */}
          {/* YEARLY PLAN CARD */}
          {/* ======================================== */}
          <div className="rounded-2xl border-2 border-primary/50 bg-slate-900 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary/50" />
            <div className="flex justify-center mb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Crown className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Yearly Plan
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Full access forever with annual maintenance
            </p>

            <div className="mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold text-white">
                  ₹20,000
                </span>
                <span className="text-slate-400 text-lg">one-time</span>
              </div>
              <div className="flex items-baseline justify-center gap-1 mt-2">
                <span className="text-xl font-semibold text-white">
                  + ₹10,000
                </span>
                <span className="text-slate-400">/year</span>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                maintenance, customization, dev & support
              </p>
            </div>

            <ul className="space-y-3 text-left mb-8">
              {[
                "All core CRM features",
                "WhatsApp Shared Inbox",
                "Contact Management & Tags",
                "Sales Pipelines & Deals",
                "Broadcast Messaging",
                "No-Code Automations",
                "Flow Builder",
                "Account Sharing (Multi-User)",
                "Customization & New Development",
                "Priority Support",
                "Software Updates",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-300">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="block w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Get Started Now
            </Link>
            <p className="text-slate-500 text-xs mt-3">
              Have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to buy.
            </p>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-8 max-w-md mx-auto">
          ₹20,000 one-time unlocks all features forever. ₹10,000/year for
          maintenance & support. Upgrade anytime — even during your trial.
        </p>
      </section>

      {/* ======================================== */}
      {/* HOW IT WORKS */}
      {/* ======================================== */}
      <section className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              How It Works
            </h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Register for Free",
                desc: "Create your account in seconds. No credit card needed. Start your 5-min free trial immediately.",
              },
              {
                step: "02",
                title: "Explore All Features",
                desc: "Inbox, contacts, pipelines, broadcasts, automations — everything is unlocked during your trial.",
              },
              {
                step: "03",
                title: "Choose Your Plan",
                desc: "Love it? Pay ₹20,000 one-time to keep access forever. Add ₹10,000/year for ongoing support.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================== */}
      {/* FOOTER */}
      {/* ======================================== */}
      <footer className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <MessageSquare className="h-4 w-4" />
            OptiFlow CRM — WhatsApp CRM Platform
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link href="/login" className="hover:text-slate-300 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-slate-300 transition-colors">
              Register
            </Link>
            <span>🔒 Payments secured by Razorpay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}