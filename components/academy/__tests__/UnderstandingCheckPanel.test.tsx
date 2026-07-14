import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UnderstandingCheckPanel } from "@/components/academy/UnderstandingCheckPanel";

vi.mock("@/actions/academy-checkpoint-actions", () => ({
  openCheckpointAction: vi.fn(),
  confirmUnderstandingAction: vi.fn(),
  skipCheckpointAction: vi.fn(),
  logHelpOptionSelectedAction: vi.fn(),
  logNextLessonOpenedAction: vi.fn(),
  saveApplicationOutputToMemoryAction: vi.fn(),
  saveMessageVisualAction: vi.fn(),
}));

import * as actions from "@/actions/academy-checkpoint-actions";

const baseCheckpoint = {
  id: "cp1",
  userId: "u1",
  lessonId: "l1",
  courseId: "c1",
  status: "opened",
  understandingConfirmed: false,
  understandingConfirmedAt: null,
  lastHelpOption: null,
  skippedAt: null,
  applicationOutput: null,
  applicationOutputSavedAt: null,
  openedAt: new Date(),
  lastInteractionAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

function emptyStreamResponse() {
  return {
    ok: true,
    body: { getReader: () => ({ read: () => Promise.resolve({ done: true, value: undefined }) }) },
  } as any;
}

function streamResponseWithContent(text: string) {
  const encoder = new TextEncoder();
  const chunks = [encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`), encoder.encode("data: [DONE]\n\n")];
  let i = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: () => {
          if (i < chunks.length) return Promise.resolve({ done: false, value: chunks[i++] });
          return Promise.resolve({ done: true, value: undefined });
        },
      }),
    },
  } as any;
}

function renderPanel() {
  return render(
    <UnderstandingCheckPanel
      open
      onOpenChange={() => {}}
      lessonId="l1"
      lessonTitle="What is a niche?"
      onDone={() => {}}
    />
  );
}

beforeEach(() => {
  vi.mocked(actions.openCheckpointAction).mockResolvedValue({
    isSuccess: true,
    message: "OK",
    data: { checkpoint: baseCheckpoint, messages: [] },
  });
  vi.mocked(actions.confirmUnderstandingAction).mockResolvedValue({
    isSuccess: true,
    message: "OK",
    data: { checkpoint: { ...baseCheckpoint, understandingConfirmed: true }, unlockedAchievement: null },
  });
  vi.mocked(actions.skipCheckpointAction).mockResolvedValue({ isSuccess: true, message: "OK", data: baseCheckpoint });
  vi.mocked(actions.logHelpOptionSelectedAction).mockResolvedValue({ isSuccess: true, message: "OK" });
  vi.mocked(actions.logNextLessonOpenedAction).mockResolvedValue({ isSuccess: true, message: "OK" });
  vi.mocked(actions.saveMessageVisualAction).mockResolvedValue({ isSuccess: true, message: "OK" });
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("UnderstandingCheckPanel", () => {
  it('"Yes, I understand" confirms understanding without any model/fetch request', async () => {
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalledWith("l1"));

    const btn = await screen.findByRole("button", { name: /Yes, I understand/i });
    fireEvent.click(btn);

    await waitFor(() => expect(actions.confirmUnderstandingAction).toHaveBeenCalledWith("l1"));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("opening the panel itself makes no AI request — only the DB-backed open action", async () => {
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends the help option as structured data for "Show me an example"', async () => {
    (global.fetch as any).mockResolvedValue(emptyStreamResponse());
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());

    const btn = await screen.findByRole("button", { name: /Show me an example/i });
    fireEvent.click(btn);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("/api/academy/lessons/l1/checkpoint/chat");
    const body = JSON.parse(init.body);
    expect(body.helpOption).toBe("example");
    expect(actions.logHelpOptionSelectedAction).toHaveBeenCalledWith("l1", "example");
  });

  it('"I have a question" reveals and focuses the text input without an immediate AI request', async () => {
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());

    const btn = await screen.findByRole("button", { name: /I have a question/i });
    fireEvent.click(btn);

    const textarea = await screen.findByPlaceholderText(/Ask anything about this lesson/i);
    await waitFor(() => expect(textarea).toHaveFocus());
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("dedupes rapid duplicate clicks on the same quick action to a single request", async () => {
    (global.fetch as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(emptyStreamResponse()), 20))
    );
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());

    const btn = await screen.findByRole("button", { name: /Explain it more simply/i });
    fireEvent.click(btn);
    fireEvent.click(btn); // rapid second click while the first request is still in flight

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it("preserves the user's typed question if sending it fails", async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, json: async () => ({ error: "Rate limited" }) });
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: /I have a question/i }));
    const textarea = (await screen.findByPlaceholderText(/Ask anything about this lesson/i)) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "What counts as a niche?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByText(/Rate limited/i)).toBeInTheDocument());
    await waitFor(() => expect(textarea.value).toBe("What counts as a niche?"));
  });

  it("Skip for now never blocks — closes without confirming understanding", async () => {
    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    render(
      <UnderstandingCheckPanel open onOpenChange={onOpenChange} lessonId="l1" lessonTitle="What is a niche?" onDone={onDone} />
    );
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: /Skip for now/i }));

    await waitFor(() => expect(actions.skipCheckpointAction).toHaveBeenCalledWith("l1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onDone).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("adding a visual is opt-in — no image is generated until the user clicks it", async () => {
    (global.fetch as any).mockImplementation((url: string) => {
      if (url === "/api/chat/coach/generate-image") {
        return Promise.resolve({ ok: true, json: async () => ({ url: "https://example.com/diagram.png" }) });
      }
      return Promise.resolve(streamResponseWithContent("A niche is a focused market segment."));
    });

    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: /Explain it more simply/i }));
    await screen.findByText("A niche is a focused market segment.");

    // No visual requested yet — the reply itself never triggers image generation.
    expect(global.fetch).toHaveBeenCalledTimes(1);

    fireEvent.click(await screen.findByRole("button", { name: /Add a visual/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const [url, init] = (global.fetch as any).mock.calls[1];
    expect(url).toBe("/api/chat/coach/generate-image");
    expect(JSON.parse(init.body).prompt).toContain("A niche is a focused market segment.");

    const img = await screen.findByAltText("Visual explanation");
    expect(img).toHaveAttribute("src", "https://example.com/diagram.png");
  });

  it("shows a support nudge when a prior session already crossed the struggling threshold", async () => {
    vi.mocked(actions.openCheckpointAction).mockResolvedValue({
      isSuccess: true,
      message: "OK",
      data: { checkpoint: baseCheckpoint, messages: [], struggling: true },
    });
    renderPanel();

    const link = await screen.findByRole("link", { name: /contact support/i });
    expect(link).toHaveAttribute("href", "/dashboard/messages/support");
  });

  it("does not show a support nudge for a normal (non-struggling) session", async () => {
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /contact support/i })).not.toBeInTheDocument();
  });

  it('shows an achievement banner when "Yes, I understand" unlocks one', async () => {
    vi.mocked(actions.confirmUnderstandingAction).mockResolvedValue({
      isSuccess: true,
      message: "OK",
      data: {
        checkpoint: { ...baseCheckpoint, understandingConfirmed: true },
        unlockedAchievement: { icon: "🧠", label: "First Understanding — you confirmed you truly understood a lesson!" },
      },
    });
    renderPanel();
    await waitFor(() => expect(actions.openCheckpointAction).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole("button", { name: /Yes, I understand/i }));

    await screen.findByText(/Achievement unlocked!/i);
    expect(screen.getByText(/First Understanding/i)).toBeInTheDocument();
  });
});
