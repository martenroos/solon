"use client";

import { Plus, SquareCheckBig } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getAgentDisplayName, getToolDisplayName, starterPrompts } from "./chat-types";
import type { AnalystChatState } from "./use-analyst-chat";

export function ChatComposer({ state }: { state: AnalystChatState }) {
  const {
    input,
    setInput,
    submitMessage,
    isPending,
    isToolMenuOpen,
    setIsToolMenuOpen,
    availableToolsForAgent,
    selectedAgent,
    selectedTools,
    toggleTool,
    createTaskFromConversation,
    messages,
  } = state;

  return (
    <div className="mt-3 shrink-0">
      <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
        {starterPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => submitMessage(prompt)}
            disabled={isPending}
            className="rounded-full border border-border/70 bg-background/70 px-3.5 py-1.5 text-sm text-muted-foreground transition hover:border-primary/30 hover:bg-primary/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-[1.25rem] border border-border/80 bg-background/86 p-3 shadow-[0_12px_30px_rgba(11,18,32,0.06)]">
        <textarea
          className="min-h-24 w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground"
          placeholder={`Message ${getAgentDisplayName(selectedAgent)}...`}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submitMessage(input);
            }
          }}
        />
        <div className="relative mt-3 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn("rounded-full", isToolMenuOpen ? "border-primary/35 bg-primary/10 text-primary" : "")}
            onClick={() => setIsToolMenuOpen((current) => !current)}
            disabled={isPending}
            aria-label="Open chat tools"
            aria-expanded={isToolMenuOpen}
          >
            <Plus className="size-4" />
          </Button>
          {isToolMenuOpen ? (
            <div className="absolute bottom-12 left-0 z-20 w-72 rounded-2xl border border-border bg-white p-3 shadow-[0_18px_50px_rgba(11,18,32,0.16)] dark:bg-[#252832]">
              <div className="space-y-2">
                {availableToolsForAgent.map((tool) => {
                  const isDefault = selectedAgent.default_tools.includes(tool.name);
                  const isActive = isDefault || selectedTools.includes(tool.name);
                  return (
                    <button
                      key={tool.name}
                      type="button"
                      onClick={() => toggleTool(tool.name)}
                      disabled={isPending || isDefault}
                      title={tool.description}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition",
                        isActive
                          ? "border-primary/35 bg-primary/10 text-foreground"
                          : "border-border/70 bg-background text-muted-foreground hover:border-primary/25 hover:text-foreground",
                        isDefault ? "cursor-default" : "",
                      )}
                    >
                      <span>{getToolDisplayName(tool)}</span>
                      <span className="text-xs text-muted-foreground">{isActive ? "On" : "Off"}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={createTaskFromConversation}
                  disabled={isPending || messages.length === 0}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 text-left text-sm text-foreground transition hover:border-primary/25 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <span className="flex items-center gap-2">
                    <SquareCheckBig className="size-4 text-primary" />
                    Create task
                  </span>
                  <span className="text-xs text-muted-foreground">Manual</span>
                </button>
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            className="rounded-full px-4"
            onClick={() => submitMessage(input)}
            disabled={isPending || input.trim().length === 0}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
