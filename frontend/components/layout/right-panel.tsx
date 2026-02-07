// components/layout/right-panel.tsx
"use client";

import { useEffect, useRef } from "react"; // Added imports
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
    if (s.includes("exa") || s.includes("web search") || s.includes("search")) return Search;
    if (s.includes("db") || s.includes("database") || s.includes("profile") || s.includes("nessie")) return Database;
    return Wrench;
}

export function RightPanel({ analysis, runAdjudication, isAnalyzing, events = [] }: RightPanelProps) {
    const hasAnything = (events?.length ?? 0) > 0 || !!analysis || !!isAnalyzing;

    // 1. Create a reference for the bottom of the list
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 2. Auto-scroll whenever 'events' change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [events]);

    if (!hasAnything && !isAnalyzing) {
        // ... (Empty state remains unchanged) ...
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
                    <div className="p-4 pb-24">
                        {(events ?? []).length === 0 ? (
                            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
                                Initializing agent...
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {events.map((e) => {
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

                                    if (e.kind === "tool") {
                                        const ToolIcon = pickToolIcon(e.title, e.rawToolName);
                                        return (
                                            <div key={e.id} className="flex items-start gap-2">
                                                <div className="mt-[2px] flex-shrink-0">
                                                    <ToolIcon size={16} className="text-slate-500" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                                        <p className="text-xs text-slate-700 truncate">{e.title}</p>
                                                        <div className="text-[11px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                                                            {formatTime(e.ts)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })}
                                {/* 3. The Invisible Anchor Div */}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>
            {/* Action Buttons */}
                    <div className="flex-shrink-0 border-t border-slate-200 bg-white p-3 relative z-30">
                        <div className="flex gap-2">
                            <button
                                className="flex-1 px-3 py-1.5 text-sm rounded-md border border-blue-400 font-medium transition-all duration-200"
                                style={{
                                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                    color: 'rgb(37 99 235)',
                                    boxShadow: '0 0 8px rgba(59, 130, 246, 0.15)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.12)';
                                    e.currentTarget.style.borderColor = 'rgb(37 99 235)';
                                    e.currentTarget.style.boxShadow = '0 0 12px rgba(59, 130, 246, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
                                    e.currentTarget.style.borderColor = 'rgb(96 165 250)';
                                    e.currentTarget.style.boxShadow = '0 0 8px rgba(59, 130, 246, 0.15)';
                                }}
                                onClick={() => console.log("Close case clicked")}
                            >
                                Close Case
                            </button>
                            <button
                                className="flex-1 px-3 py-1.5 text-sm rounded-md border border-red-400 font-medium transition-all duration-200"
                                style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.30)',
                                    color: 'rgb(200 50 50)',
                                    boxShadow: '0 0 8px rgba(239, 68, 68, 0.15)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.50)';
                                    e.currentTarget.style.borderColor = 'rgb(220 38 38)';
                                    e.currentTarget.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.30)';
                                    e.currentTarget.style.borderColor = 'rgb(248 113 113)';
                                    e.currentTarget.style.boxShadow = '0 0 8px rgba(239, 68, 68, 0.15)';
                                }}
                                onClick={() => console.log("Escalate clicked")}
                            >
                                Escalate
                            </button>
                        </div>
                    </div>
        </div>
    );
}