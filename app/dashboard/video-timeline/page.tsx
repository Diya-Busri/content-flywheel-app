/**
 * Video Timeline page — loaded client-only (ssr: false) because:
 * 1. FFmpeg WASM cannot run on the server
 * 2. useSearchParams() is used deep in the component tree
 * 3. AudioContext and other browser APIs are used at runtime
 */
import dynamic from "next/dynamic";

const VideoTimelineApp = dynamic(() => import("./VideoTimelineApp"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
    </div>
  ),
});

export default function VideoTimelinePage() {
  return <VideoTimelineApp />;
}
