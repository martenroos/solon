"use client";

import Image from "next/image";
import { LoaderCircle } from "lucide-react";

import { getAgentDisplayName } from "./chat-types";
import type { AnalystChatState } from "./use-analyst-chat";

export function ChatThread({ state, userInitial }: { state: AnalystChatState; userInitial: string }) {
  const { messages, isPending, selectedAgent, scrollContainerRef } = state;

  return (
    <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-1 sm:px-2">
      <div className="space-y-5 pb-4">
        {messages.map((message) => {
          const isAssistant = message.role === "assistant";

          return (
            <div key={message.id} className={`flex gap-3 ${isAssistant ? "items-start" : "justify-end"}`}>
              {isAssistant ? (
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 p-1.5 text-primary">
                  <Image
                    src="/ai-head.png"
                    alt="AI"
                    width={32}
                    height={32}
                    className="h-full w-full object-contain dark:invert"
                  />
                </div>
              ) : null}

              <div className={`max-w-3xl ${isAssistant ? "" : "flex justify-end"}`}>
                <div
                  className={
                    isAssistant
                      ? "rounded-[1.25rem] bg-transparent px-1 py-1"
                      : "rounded-[1.25rem] rounded-tr-md bg-[#0B1220] px-4 py-3.5 text-white shadow-[0_14px_30px_rgba(11,18,32,0.16)]"
                  }
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className={isAssistant ? "font-medium text-foreground" : "font-medium text-white"}>
                      {isAssistant ? getAgentDisplayName(selectedAgent) : "You"}
                    </span>
                    <span className={isAssistant ? "text-muted-foreground" : "text-white/55"}>
                      {message.timestamp}
                    </span>
                    {isAssistant && message.model ? (
                      <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {message.model}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={`mt-2.5 whitespace-pre-wrap text-sm leading-7 ${
                      isAssistant ? "text-foreground" : "text-white/88"
                    }`}
                  >
                    {message.content}
                  </p>
                </div>
              </div>

              {!isAssistant ? (
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-sm font-semibold text-foreground shadow-sm">
                  {userInitial}
                </div>
              ) : null}
            </div>
          );
        })}

        {isPending ? (
          <div className="flex items-start gap-3">
            <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LoaderCircle className="size-4 animate-spin" />
            </div>
            <div className="rounded-[1.25rem] bg-transparent px-1 py-1 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
