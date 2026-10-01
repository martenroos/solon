"use client";

import { ChatComposer } from "@/components/analyst/chat-composer";
import { ChatSidebar } from "@/components/analyst/chat-sidebar";
import { ChatThread } from "@/components/analyst/chat-thread";
import { useAnalystChat } from "@/components/analyst/use-analyst-chat";

type AnalystChatProps = {
  userInitial: string;
};

export function AnalystChat({ userInitial }: AnalystChatProps) {
  const state = useAnalystChat();
  const { error } = state;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
      <ChatSidebar state={state} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] border border-border/70 bg-card/78 p-4 shadow-[0_22px_60px_rgba(11,18,32,0.1)] backdrop-blur-md sm:p-5">
        <ChatThread state={state} userInitial={userInitial} />

        {error ? (
          <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <ChatComposer state={state} />
      </div>
    </section>
  );
}
