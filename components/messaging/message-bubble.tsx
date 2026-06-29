"use client";

import { Shield } from "lucide-react";
import { messageTime } from "./message-time";

interface MessageBubbleProps {
  content: string;
  isOwn: boolean;
  senderEmail?: string | null;
  timestamp: Date | string;
  isAdmin?: boolean;
}

export function MessageBubble({ content, isOwn, senderEmail, timestamp, isAdmin }: MessageBubbleProps) {
  return (
    <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
      {isAdmin && !isOwn && (
        <span className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-primary">
          <Shield className="h-3 w-3" /> Content Flywheel Support
        </span>
      )}
      {!isAdmin && !isOwn && senderEmail && (
        <span className="mb-0.5 max-w-[200px] truncate text-[11px] text-muted-foreground">{senderEmail}</span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words ${
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border text-foreground rounded-bl-sm"
        }`}
      >
        {content}
      </div>
      <span className="mt-0.5 text-[10px] text-muted-foreground">{messageTime(timestamp)}</span>
    </div>
  );
}
