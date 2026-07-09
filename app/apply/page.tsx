"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, Clock, XCircle, ArrowRight, Sparkles } from "lucide-react";

type ApplicationStatus = "pending" | "accepted" | "waitlisted" | "rejected";

const PLATFORM_OPTIONS = [
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram / Reels" },
  { value: "other", label: "Other" },
];

const GOAL_OPTIONS = [
  "Grow my audience faster",
  "Monetise my content",
  "Create content consistently",
  "Build a brand / business",
  "Launch a digital product",
];

type FieldErrors = {
  name?: string;
  email?: string;
  platform?: string;
  followerCount?: string;
  niche?: string;
  goal?: string;
};

function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function ApplyForm() {
  const searchParams = useSearchParams();
  const referrerUserId = searchParams.get("ref") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState("");
  const [niche, setNiche] = useState("");
  const [followerCount, setFollowerCount] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ status: ApplicationStatus; duplicate?: boolean } | null>(null);
  const [apiError, setApiError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const touch = (field: string) => setTouched(prev => ({ ...prev, [field]: true }));

  function validate(fields?: Partial<FieldErrors>): FieldErrors {
    const errs: FieldErrors = {};
    const n = name.trim(); const e = email.trim();
    if (!n) errs.name = "Name is required.";
    else if (n.length < 2) errs.name = "Name must be at least 2 characters.";
    if (!e) errs.email = "Email address is required.";
    else if (!validateEmail(e)) errs.email = "Enter a valid email address.";
    if (!platform) errs.platform = "Please select your primary platform.";
    const raw = followerCount.replace(/,/g, "").trim();
    if (!raw) errs.followerCount = "Follower count is required.";
    else if (isNaN(parseInt(raw, 10)) || parseInt(raw, 10) < 0) errs.followerCount = "Enter a valid number.";
    if (!niche.trim()) errs.niche = "Please describe your niche.";
    if (!goal) errs.goal = "Please select a main goal.";
    return { ...errs, ...fields };
  }

  const handleBlur = (field: keyof FieldErrors) => {
    touch(field);
    setErrors(prev => ({ ...prev, ...validate() }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError("");
    const allTouched = Object.fromEntries(
      ["name", "email", "platform", "followerCount", "niche", "goal"].map(f => [f, true])
    );
    setTouched(allTouched);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const count = parseInt(followerCount.replace(/,/g, ""), 10);
    setLoading(true);
    try {
      const res = await fetch("/api/creator-acceptance/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          platform,
          niche: niche.trim(),
          followerCount: count,
          goal,
          referrerUserId: referrerUserId || null,
        }),
      });
      const data = (await res.json()) as { status?: ApplicationStatus; duplicate?: boolean; error?: string };
      if (!res.ok || data.error) {
        setApiError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setResult({ status: data.status!, duplicate: data.duplicate });
      }
    } catch {
      setApiError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // True only when every field contains a valid value — gates the submit button
  const canSubmit =
    name.trim().length >= 2 &&
    validateEmail(email.trim()) &&
    platform !== "" &&
    (() => {
      const raw = followerCount.replace(/,/g, "").trim();
      return raw !== "" && !isNaN(parseInt(raw, 10)) && parseInt(raw, 10) >= 0;
    })() &&
    niche.trim() !== "" &&
    goal !== "";

  const fieldClass = (field: keyof FieldErrors, base: string) =>
    `${base} ${touched[field] && errors[field] ? "border-red-500/70 focus:border-red-500" : "border-[#2A2A2A] focus:border-orange-500"}`;

  if (result) {
    return <ResultScreen status={result.status} name={name} duplicate={result.duplicate} />;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Content Flywheel</span>
        </div>
        <Link href="/sign-in" className="text-sm text-gray-400 hover:text-white transition-colors">
          Already a member? Sign in
        </Link>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Badge */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-wide">
              🎬 Creator Acceptance Program
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3 leading-tight">
            Apply to join <br />
            <span className="text-orange-400">Content Flywheel</span>
          </h1>
          <p className="text-gray-400 text-center text-base mb-10 leading-relaxed">
            We accept creators who are serious about growing. Fill in your details below — 10k+ followers are accepted instantly.
          </p>

          {/* Form */}
          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (touched.name) setErrors(prev => ({ ...prev, ...validate() })); }}
                  onBlur={() => handleBlur("name")}
                  placeholder="e.g. Alex Turner"
                  className={fieldClass("name", "w-full bg-[#1A1A1A] border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors")}
                />
                {touched.name && errors.name && (
                  <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                )}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (touched.email) setErrors(prev => ({ ...prev, ...validate() })); }}
                  onBlur={() => handleBlur("email")}
                  placeholder="you@email.com"
                  className={fieldClass("email", "w-full bg-[#1A1A1A] border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors")}
                />
                {touched.email && errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Primary platform</label>
                <select
                  value={platform}
                  onChange={(e) => { setPlatform(e.target.value); touch("platform"); setErrors(prev => ({ ...prev, ...validate() })); }}
                  onBlur={() => handleBlur("platform")}
                  className={fieldClass("platform", "w-full bg-[#1A1A1A] border rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none transition-colors appearance-none")}
                >
                  <option value="" disabled>Select…</option>
                  {PLATFORM_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {touched.platform && errors.platform && (
                  <p className="mt-1 text-xs text-red-400">{errors.platform}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Follower count</label>
                <input
                  type="text"
                  value={followerCount}
                  onChange={(e) => { setFollowerCount(e.target.value); if (touched.followerCount) setErrors(prev => ({ ...prev, ...validate() })); }}
                  onBlur={() => handleBlur("followerCount")}
                  placeholder="e.g. 15000"
                  className={fieldClass("followerCount", "w-full bg-[#1A1A1A] border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors")}
                />
                {touched.followerCount && errors.followerCount && (
                  <p className="mt-1 text-xs text-red-400">{errors.followerCount}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Your niche</label>
              <input
                type="text"
                value={niche}
                onChange={(e) => { setNiche(e.target.value); if (touched.niche) setErrors(prev => ({ ...prev, ...validate() })); }}
                onBlur={() => handleBlur("niche")}
                placeholder="e.g. 3D Animation Comedy, Finance, Fitness, Beauty…"
                className={fieldClass("niche", "w-full bg-[#1A1A1A] border rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors")}
              />
              {touched.niche && errors.niche && (
                <p className="mt-1 text-xs text-red-400">{errors.niche}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Main goal</label>
              <div className="grid grid-cols-1 gap-2">
                {GOAL_OPTIONS.map((g) => (
                  <label
                    key={g}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      goal === g
                        ? "border-orange-500 bg-orange-500/10"
                        : touched.goal && errors.goal
                        ? "border-red-500/40 bg-[#1A1A1A] hover:border-red-500/60"
                        : "border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#3A3A3A]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="goal"
                      value={g}
                      checked={goal === g}
                      onChange={() => { setGoal(g); touch("goal"); setErrors(prev => ({ ...prev, goal: undefined })); }}
                      className="accent-orange-500"
                    />
                    <span className="text-sm text-gray-200">{g}</span>
                  </label>
                ))}
              </div>
              {touched.goal && errors.goal && (
                <p className="mt-1.5 text-xs text-red-400">{errors.goal}</p>
              )}
            </div>

            {apiError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {apiError}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all text-base mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Reviewing your application…</>
              ) : (
                <>Submit application <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-600 mt-6">
            By applying you agree to our terms. We only contact you about your application.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({
  status,
  name,
  duplicate,
}: {
  status: ApplicationStatus;
  name: string;
  duplicate?: boolean;
}) {
  if (status === "accepted") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">
            {duplicate ? "You're already accepted!" : `You're in, ${name}! 🎉`}
          </h1>
          <p className="text-gray-400 text-base leading-relaxed mb-8">
            {duplicate
              ? "Your application was already accepted. Create your account to get started."
              : "Your application has been accepted. Check your email — we've sent you everything you need to get started."}
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Create your account <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (status === "waitlisted") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <Clock className="w-16 h-16 text-orange-400 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-3">
            {duplicate ? "You're on the waitlist" : `You're on the waitlist, ${name}`}
          </h1>
          <p className="text-gray-400 text-base leading-relaxed mb-4">
            {duplicate
              ? "Your application is still under review."
              : "We've received your application and you're on our priority waitlist. We'll email you the moment a spot opens."}
          </p>
          <p className="text-gray-500 text-sm">
            Fast-track tip: creators with <strong className="text-gray-300">10,000+ followers</strong> are accepted automatically. Keep growing!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <XCircle className="w-16 h-16 text-gray-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3">Not this time</h1>
        <p className="text-gray-400 text-base leading-relaxed">
          We were not able to offer you a spot right now. Keep building your audience and feel free to apply again in the future.
        </p>
      </div>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <ApplyForm />
    </Suspense>
  );
}
