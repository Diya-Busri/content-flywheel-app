"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { ArrowRight } from "lucide-react";
import { useContentStudio } from "@/app/dashboard/content-studio/create/ContentStudioContext";

/** Matches ContentStudioContext WizardData (snake_case). */
export type WizardData = {
  current_step?: number;
  topics?: string | null;
  selected_niche?: string | null;
  content_style?: string | null;
  selected_topic?: { title?: string; hook_angle?: string; id?: string } | null;
  script_strategy?: Record<string, unknown> | null;
};

type Props = {
  wizardData: WizardData;
  onNext: (data?: Partial<WizardData>) => void;
  onBack: () => void;
};

const step1Schema = z
  .object({
    topics: z.string().optional(),
    notSureYet: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const hasTopics = data.topics != null && data.topics.trim().length > 0;
      return data.notSureYet || hasTopics;
    },
    { message: "Enter topics or check “I'm not sure yet”", path: ["topics"] }
  );

type Step1FormValues = z.infer<typeof step1Schema>;

export function Step1AboutYou({ wizardData, onNext, onBack }: Props) {
  const router = useRouter();
  const { updateWizardData } = useContentStudio();

  const form = useForm<Step1FormValues>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      topics: wizardData.topics ?? (wizardData as { topics?: string }).topics ?? "",
      notSureYet: false,
    },
    mode: "onSubmit",
  });

  const notSureYet = form.watch("notSureYet");
  const topics = form.watch("topics");
  const hasTopicsOrCheck = notSureYet || (topics != null && topics.trim().length > 0);
  const isValid = hasTopicsOrCheck;

  const onSubmit = async (values: Step1FormValues) => {
    const topicsValue = values.notSureYet ? null : (values.topics?.trim() || null);
    await updateWizardData({
      topics: topicsValue,
      current_step: 2,
    });
    router.push("/dashboard/content-studio/create?step=2");
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
        Step 1 of 7 — Tell Us About You
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Help us understand your content goals
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="topics"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="topics" className="text-sm font-medium text-gray-900 dark:text-white">
                  What topics interest you?
                </Label>
                <FormControl>
                  <Textarea
                    id="topics"
                    placeholder="e.g., fitness, budgeting, productivity, travel, tech reviews, cooking..."
                    className="min-h-[100px] resize-y border-[#E5E7EB] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder:text-gray-500"
                    rows={4}
                    disabled={notSureYet}
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-gray-500 dark:text-gray-400">
                  Don&apos;t overthink it — just list things you know about or enjoy
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notSureYet"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    id="notSureYet"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-[#E5E7EB] dark:border-[#2A2A2A] data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="notSureYet"
                    className="text-sm font-normal text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    I&apos;m not sure yet — show me what&apos;s selling well!
                  </Label>
                </div>
              </FormItem>
            )}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              className="border-[#E5E7EB] dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={!isValid}
              className={
                isValid
                  ? "bg-orange-500 hover:bg-orange-600 text-white gap-2"
                  : "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed gap-2"
              }
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
