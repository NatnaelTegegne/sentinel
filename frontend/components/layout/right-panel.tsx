// components/layout/right-panel.tsx
"use client";

import { AIAnalysis } from "@/app/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/libf/utils";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type RightPanelEvent = {
  id: string;
  kind: "run" | "tool";
  title: string;
  status: "running" | "info" | "complete";
  ts: number;
};

interface RightPanelProps {
  analysis?: AIAnalysis | null;
  runAdjudication?: () => void;
  isAnalyzing?: boolean;
  events?: RightPanelEvent[];
}

export function RightPanel({ analysis, runAdjudication, isAnalyzing, events = [] }: RightPanelProps) {
  if (!analysis && !isAnalyzing) {
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
          AI Copilot
        </span>
        <Badge variant="secondary" className="ml-auto bg-blue-50 text-blue-700 text-[10px] border-blue-100">
          {isAnalyzing ? "Running..." : "Complete"}
        </Badge>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full">
          <div className="p-4 safe-area-bottom">
            {/* Activity Feed */}
            <div className="mb-6">
              <p className="text-xs font-medium text-slate-700 mb-2">Activity</p>

              <div className="space-y-2">
                {events.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    No activity yet.
                  </div>
                ) : (
                  events.map((e) => (
                    <div
                      key={e.id}
                      className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex gap-3"
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {e.status === "running" ? (
                          <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                        ) : e.kind === "tool" ? (
                          <AlertTriangle size={16} className="text-amber-600" />
                        ) : (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        )}
                      </div>

                      <div className="min-w-0 w-full">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-slate-800 truncate">{e.title}</p>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "ml-auto text-[10px]",
                              e.status === "running" && "bg-blue-50 text-blue-700 border-blue-100",
                              e.status === "complete" && "bg-emerald-50 text-emerald-700 border-emerald-100",
                              e.status === "info" && "bg-amber-50 text-amber-700 border-amber-100"
                            )}
                          >
                            {e.status}
                          </Badge>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-1">
                          {new Date(e.ts).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator className="my-4" />

            {/* Live Summary Stream */}
            <div className="flex gap-3 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mt-0.5 text-blue-600 flex-shrink-0">
                {isAnalyzing ? (
                  <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
              </div>

              <div className="w-full min-w-0">
                <p className="text-xs font-medium text-slate-700 mb-2">Live Reasoning</p>
                <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-sm text-slate-800 leading-relaxed shadow-sm prose prose-sm max-w-none prose-blue prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-li:my-0 break-words">
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
                    {analysis?.summary || "Initializing agent..."}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
