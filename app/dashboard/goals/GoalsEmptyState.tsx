"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Target, ClipboardList, ShieldCheck, Flame } from "lucide-react";
import CreateGoalModal from "./CreateGoalModal";

export default function GoalsEmptyState() {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSuccess = (goalId: string) => {
    setModalOpen(false);
    window.location.href = `/dashboard/goals/${goalId}`;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <CreateGoalModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSuccess={handleSuccess}
      />
      <div className="p-6 md:p-10 max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-orange-400 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>

        <section className="text-center py-16 md:py-24">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Set Goals. Stay Accountable. Build Consistently.
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-xl mx-auto mb-10">
            Break big targets into daily actions. Track progress with proof.
          </p>
          <Button
            size="lg"
            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 text-base px-8 py-6 h-auto rounded-lg"
            onClick={() => setModalOpen(true)}
          >
            <Target className="w-5 h-5" />
            Create Your First Goal
          </Button>
        </section>

        <section className="flex justify-center gap-6 py-8 md:py-12">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700 text-orange-400">
            <ClipboardList className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700 text-orange-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700 text-orange-400">
            <Flame className="w-7 h-7" />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3 mt-8 md:mt-12 pb-16">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-5 h-5 text-orange-400 shrink-0" />
                <CardTitle className="text-base text-white">Daily Tasks</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                AI breaks goals into actionable daily steps
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-orange-400 shrink-0" />
                <CardTitle className="text-base text-white">Proof Required</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                Submit evidence of completion — no cheating
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-5 h-5 text-orange-400 shrink-0" />
                <CardTitle className="text-base text-white">Streak Tracking</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">
                Build momentum with consecutive days
              </p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
