// components/layout/right-panel.tsx
"use client";

import { AIAnalysis } from "@/app/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Sparkles, Search, Database, Wrench } from "lucide-react";
import { cn } from "@/libf/utils";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type RightPanelEvent =
  | { id: string; kind: "run"; title: string; status: "running" | "complete"; ts: number }
  | { id: string; kind: "tool"; title: string; status: "info"; ts: number; rawToolName?: string }
  | { id: string; kind: "text"; markdown: string; ts: number };

interface RightPanelProps {
  analysis?: AIAnalysis | null;
  runAdjudication?: () => void;
  isAnalyzing?: boolean;
  events?: RightPanelEvent[];
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function pickToolIcon(title: string, rawToolName?: string) {
  const s = `${title} ${rawToolName ?? ""}`.toLowerCase();

  // Search tools
  if (s.includes("exa") || s.includes("web search") || s.includes("search")) return Search;

  // DB / profile / banking
  if (s.includes("db") || s.includes("database") || s.includes("profile") || s.includes("nessie")) return Database;

  // Fallback
  return Wrench;
}

export function RightPanel({ analysis, runAdjudication, isAnalyzing, events = [] }: RightPanelProps) {
  const hasAnything = (events?.length ?? 0) > 0 || !!analysis || !!isAnalyzing;

  if (!hasAnything && !isAnalyzing) {
    return (
      <div className="w-[350px] border-l border-slate-200 bg-white flex flex-col h-full shadow-xl shadow-slate-200/50 z-20 items-center justify-center p-6 text-center">
        <div className="mb-4 text-slate-400">
          <div className="h-16 w-16 bg-slate-100 rounded-full mx-auto flex items-center justify-center mb-2">
            <CheckCircle2 size={32} className="opacity-50" />
          </div>
        </div>
        <h3 className="font-semibold text-slate-800 mb-2">Ready to Adjudicate</h3>
        <p className="text-sm text-slate-500 mb-6">
          Run the AI agent to scan for adverse media and adjudicate this case.
        </p>
        <Button onClick={runAdjudication} className="bg-blue-600 hover:bg-blue-700 w-full">
          Start Investigation
        </Button>
      </div>
    );
  }

  return (
    <div className="w-[350px] border-l border-slate-200 bg-white flex flex-col h-full shadow-xl shadow-slate-200/50 z-20">
      {/* Header */}
      <div className="h-14 flex items-center px-4 border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
        <span className="font-semibold text-sm text-slate-800 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isAnalyzing ? "bg-blue-500 animate-pulse" : "bg-emerald-500"}`} />
          Sentinel Agent
        </span>

        <Badge
          variant="secondary"
          className={cn(
            "ml-auto text-[10px]",
            isAnalyzing
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : "bg-emerald-50 text-emerald-700 border-emerald-100"
          )}
        >
          {isAnalyzing ? "Running..." : "Complete"}
        </Badge>
      </div>

      {/* Unified feed */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full">
          <div className="p-4 safe-area-bottom">
            {(events ?? []).length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                Initializing agent...
              </div>
            ) : (
              <div className="space-y-3">
                {(events ?? []).map((e) => {
                  // TEXT: big card
                  if (e.kind === "text") {
                    return (
                      <div
                        key={e.id}
                        className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
                      >
                        <div className="px-3 pt-3 pb-2 flex items-center gap-2 text-[11px] text-slate-500">
                          <Sparkles size={14} className="text-blue-600" />
                          <span>Synthesizing narrative…</span>
                          <span className="ml-auto">{formatTime(e.ts)}</span>
                        </div>

                        <div className="px-3 pb-3">
                          <div className="text-sm text-slate-800 leading-relaxed break-words prose prose-sm max-w-none prose-blue prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                a: ({ node, ...props }) => (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline break-all"
                                  />
                                )
                              }}
                            >
                              {e.markdown}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  }
                
                  // TOOL ROW: icon only (no spinner, no warning)
                  if (e.kind === "tool") {
                    const ToolIcon = pickToolIcon(e.title, e.rawToolName);

                    return (
                      <div key={e.id} className="flex items-start gap-2">
                        <div className="mt-[2px] flex-shrink-0">
                          <ToolIcon size={16} className="text-slate-500" />
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Added 'justify-between' to push content apart */}
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <p className="text-xs text-slate-700 truncate">{e.title}</p>

                            {/* Added 'whitespace-nowrap' and 'flex-shrink-0' so time doesn't wrap or get crushed */}
                            <div className="text-[11px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                              {formatTime(e.ts)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // (Run events not expected; safe fallback)
                  return null;
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
