"use client";

import { ArrowUp, ChartColumnBig, ChevronLeft, ChevronRight, MessageSquareText, PanelLeft, Plus, SquareCheckBig } from "lucide-react";

import { ChatChartList, ChatQueryResultList } from "@/components/chat-chart-sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { formatConversationDate } from "./chat-mappers";
import type { AnalystChatState } from "./use-analyst-chat";

export function ChatSidebar({ state }: { state: AnalystChatState }) {
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    resetConversation,
    sidebarTab,
    setSidebarTab,
    conversations,
    conversationId,
    loadConversation,
    isHistoryPending,
    sidebarScrollContainerRef,
    handleSidebarScroll,
    addedTaskTitles,
    queryResults,
    charts,
    addChartToSurface,
    getChartSourceQuerySql,
    pendingChartAction,
    addedChartAction,
    showChartsScrollTop,
    scrollChartsToTop,
  } = state;

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col rounded-[1.5rem] border border-border/70 bg-card/80 shadow-[0_18px_50px_rgba(11,18,32,0.08)] backdrop-blur-md transition-all duration-200 lg:self-stretch",
        isSidebarOpen ? "w-full p-3 lg:w-80 lg:min-w-80" : "w-full p-2 lg:w-16 lg:min-w-16",
      )}
    >
      <div className={cn("flex items-center", isSidebarOpen ? "justify-between gap-2" : "flex-col gap-2")}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          onClick={() => setIsSidebarOpen((current) => !current)}
          aria-label={isSidebarOpen ? "Collapse previous chats" : "Expand previous chats"}
        >
          {isSidebarOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
        <Button
          type="button"
          variant={isSidebarOpen ? "outline" : "ghost"}
          size={isSidebarOpen ? "sm" : "icon-sm"}
          className={cn("rounded-full", isSidebarOpen ? "px-3" : "")}
          onClick={resetConversation}
          aria-label="Start new chat"
        >
          <Plus className="size-4" />
          {isSidebarOpen ? <span>New chat</span> : null}
        </Button>
      </div>

      {isSidebarOpen ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSidebarTab("conversations")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition",
                sidebarTab === "conversations"
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "border-border/60 bg-background/75 text-muted-foreground hover:text-foreground",
              )}
            >
              Chats
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab("results")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm transition",
                sidebarTab === "results"
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "border-border/60 bg-background/75 text-muted-foreground hover:text-foreground",
              )}
            >
              Results
            </button>
          </div>
          <div className="relative mt-3 min-h-0 flex-1">
            <div
              ref={sidebarScrollContainerRef}
              className="h-full overflow-y-auto"
              onScroll={handleSidebarScroll}
            >
              {sidebarTab === "conversations" ? (
                <div className="space-y-2">
                  {conversations.map((item) => {
                    const isActive = item.conversation_id === conversationId;
                    return (
                      <button
                        key={item.conversation_id}
                        type="button"
                        onClick={() => loadConversation(item.conversation_id)}
                        className={cn(
                          "w-full rounded-xl border px-3 py-3 text-left transition",
                          isActive
                            ? "border-primary/30 bg-primary/8"
                            : "border-border/60 bg-background/65 hover:border-primary/20 hover:bg-background/85",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-sm font-medium text-foreground">{item.title}</p>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {formatConversationDate(item.created_at)}
                          </span>
                        </div>
                        {item.preview ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {item.preview}
                          </p>
                        ) : null}
                      </button>
                    );
                  })}
                  {!isHistoryPending && conversations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-background/50 px-3 py-4 text-sm text-muted-foreground">
                      No previous chats yet.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  {addedTaskTitles.length > 0 ? (
                    <div className="rounded-2xl border border-primary/20 bg-primary/7 px-4 py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <SquareCheckBig className="size-4 text-primary" />
                        Added to task board
                      </div>
                      <div className="mt-3 space-y-2">
                        {addedTaskTitles.map((taskTitle) => (
                          <p key={taskTitle} className="text-sm leading-5 text-muted-foreground">
                            {taskTitle}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {queryResults.length > 0 ? (
                    <ChatQueryResultList queryResults={queryResults} />
                  ) : null}
                  {charts.length > 0 ? (
                    <ChatChartList
                      charts={charts}
                      onAddToSurface={addChartToSurface}
                      getSourceQuerySql={getChartSourceQuerySql}
                      pendingChartAction={pendingChartAction}
                      addedChartAction={addedChartAction}
                    />
                  ) : null}
                  {queryResults.length === 0 && charts.length === 0 && addedTaskTitles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/55 px-4 py-6 text-sm text-muted-foreground">
                      Query results, charts, and tasks created during the conversation will appear here.
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            {sidebarTab === "results" && showChartsScrollTop ? (
              <Button
                type="button"
                size="icon-sm"
                className="absolute right-4 bottom-4 z-10 rounded-full shadow-lg"
                onClick={scrollChartsToTop}
                aria-label="Scroll charts to top"
              >
                <ArrowUp className="size-4" />
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-1 flex-col items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground">
            <PanelLeft className="size-4" />
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground">
            <MessageSquareText className="size-4" />
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground">
            <ChartColumnBig className="size-4" />
          </div>
        </div>
      )}
    </aside>
  );
}
