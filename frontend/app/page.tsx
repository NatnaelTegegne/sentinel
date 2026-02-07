// app/page.tsx
'use client';

import { WorkbenchLayout } from "@/components/layout/workbench-layout";
import { EvidenceFeed } from "@/components/layout/evidence-feed";
import { ClientProfile, AIAnalysis, SummaryCardData } from "@/app/data";
import { useEffect, useState } from "react";

type SSEMessage = {
  event: string;
  data: any;
  id?: string;
};

function parseSSE(buffer: string) {
  const messages: SSEMessage[] = [];
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() ?? "";

  for (const part of parts) {
    const lines = part.split("\n");
    let event = "message";
    let id: string | undefined;
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("id:")) id = line.slice(3).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }

    const dataStr = dataLines.join("\n");
    let data: any = dataStr;
    try {
      data = JSON.parse(dataStr);
    } catch {
      // keep as string
    }

    messages.push({ event, data, id });
  }

  return { messages, remainder };
}

type RightPanelEvent =
  | { id: string; kind: "run"; title: string; status: "running" | "complete"; ts: number }
  | { id: string; kind: "tool"; title: string; status: "info"; ts: number; rawToolName?: string }
  | { id: string; kind: "text"; markdown: string; ts: number };

type AnalysisResult = {
  analysis: AIAnalysis;
  summary: SummaryCardData | null;
  events: RightPanelEvent[];
};

function humanizeToolName(name: string) {
  const cleaned = name
    .replace(/^mcp[-_:]/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function prettyToolTitle(raw: string) {
  const n = (raw || "").toLowerCase();

  // exact mappings (add more as needed)
  const exactMap: Record<string, string> = {
    "get_customer_profile": "Customer profile lookup",
    "query_nessie": "Banking database lookup",
    "search_news": "Adverse media search",

    "mcp-exa_search": "Web search (Exa)",
    "mcp-exa-search": "Web search (Exa)",
    "mcp_exa_search": "Web search (Exa)",
  };

  if (exactMap[raw]) return exactMap[raw];

  // fuzzy mappings
  if (n.includes("exa")) return "Web search (Exa)";
  if (n.includes("nessie")) return "Banking database lookup";
  if (n.includes("customer") && n.includes("profile")) return "Customer profile lookup";
  if (n.includes("adverse") || n.includes("news")) return "Adverse media search";
  if (n.includes("search")) return "Search";
  if (n.includes("db") || n.includes("database")) return "Database lookup";

  return humanizeToolName(raw || "Tool");
}

export default function Home() {
  const [userData, setUserData] = useState<Record<string, ClientProfile>>({});
  const [selectedUser, setSelectedUser] = useState<string>("");

  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  const API_URL = "http://127.0.0.1:8000";

  const currentResult = analysisResults[selectedUser];
  const aiAnalysis = currentResult?.analysis || null;
  const summaryCardData = currentResult?.summary || null;
  const isAnalyzing = analyzingIds.has(selectedUser);
  const rightPanelEvents = currentResult?.events ?? [];

  useEffect(() => {
    fetch(`${API_URL}/customers`)
      .then(r => r.json())
      .then((data: ClientProfile[]) => {
        const usersById = data.reduce((acc: Record<string, ClientProfile>, user) => {
          acc[user._id] = {
            ...user,
            address: typeof user.address === "object" ? JSON.stringify(user.address) : user.address
          };
          return acc;
        }, {});

        if (data.length > 0) setSelectedUser(data[0]._id);
        setUserData(usersById);
      });
  }, []);

  useEffect(() => {
    if (selectedUser && !analysisResults[selectedUser] && !analyzingIds.has(selectedUser)) {
      runAdjudication(selectedUser, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser]);

  const runAdjudication = async (customerId: string, force = true) => {
    if (!force && analysisResults[customerId]) return;
    if (analyzingIds.has(customerId)) return;

    setAnalyzingIds(prev => new Set(prev).add(customerId));

    // Reset per-customer state
    setAnalysisResults(prev => ({
      ...prev,
      [customerId]: {
        analysis: { summary: "", confidence: 0, articles: [] },
        summary: null,
        events: []
      }
    }));

    try {
      const response = await fetch(`${API_URL}/adjudicate/${customerId}`, {
        headers: { Accept: "text/event-stream" },
      });
      if (!response.body) throw new Error("ReadableStream not supported.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let accumulatedText = ""; // full raw stream (includes json block when it arrives)

      const pushEvent = (evt: RightPanelEvent) => {
        setAnalysisResults(prev => {
          const cur: AnalysisResult = prev[customerId] ?? {
            analysis: { summary: "", confidence: 0, articles: [] },
            summary: null,
            events: []
          };

          // dedupe tools by id
          if (evt.kind === "tool" && cur.events.some(e => e.id === evt.id)) return prev;

          return {
            ...prev,
            [customerId]: {
              ...cur,
              events: [...cur.events, evt]
            }
          };
        });
      };

      const upsertTextCardAndSummary = (delta: string, ts: number) => {
        if (!delta) return;

        accumulatedText += delta;

        // Extract final JSON summary block (your old logic)
        const jsonMatch = accumulatedText.match(/```json\n([\s\S]*?)\n```/);
        let displayText = accumulatedText;
        let newSummaryData: SummaryCardData | null = null;

        if (jsonMatch) {
          try {
            newSummaryData = JSON.parse(jsonMatch[1]);
            displayText = accumulatedText.replace(jsonMatch[0], "").trim();
          } catch {
            // incomplete JSON; ignore until complete
          }
        }

        setAnalysisResults(prev => {
          const cur: AnalysisResult = prev[customerId] ?? {
            analysis: { summary: "", confidence: 0, articles: [] },
            summary: null,
            events: []
          };

          const events = [...cur.events];
          const last = events[events.length - 1];

          if (last && last.kind === "text") {
            // append to the current text card (but use displayText delta semantics)
            // We only have delta; easiest is to append delta, BUT we must strip JSON from UI if it appears.
            // When JSON appears, displayText may remove the block, so we overwrite the full text card with displayText.
            const updated = { ...last, markdown: displayText };
            events[events.length - 1] = updated;
          } else {
            // start a new text card
            events.push({
              id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              kind: "text",
              markdown: displayText,
              ts
            });
          }

          return {
            ...prev,
            [customerId]: {
              ...cur,
              events,
              analysis: { ...cur.analysis, summary: displayText },
              summary: newSummaryData || cur.summary
            }
          };
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parsed = parseSSE(buffer);
        buffer = parsed.remainder;

        for (const msg of parsed.messages) {
          if (msg.event === "token") {
            upsertTextCardAndSummary(msg.data?.delta ?? "", Date.now());
          }

          // if (msg.event === "run_started") {
          //   pushEvent({
          //     id: `run-${Date.now()}`,
          //     kind: "run",
          //     title: "Agent started",
          //     status: "running",
          //     ts: msg.data?.ts ?? Date.now()
          //   });
          // }

          if (msg.event === "tool_call_started") {
            const rawTool = msg.data?.tool ?? "Tool";
            const toolId = msg.data?.id ?? `${rawTool}-${Date.now()}`;

            pushEvent({
              id: toolId,
              kind: "tool",
              title: `${prettyToolTitle(rawTool)}`,
              status: "info",
              ts: Date.now(),
              rawToolName: rawTool
            });
          }

          // if (msg.event === "run_finished") {
          //   pushEvent({
          //     id: `run-finished-${Date.now()}`,
          //     kind: "run",
          //     title: "Agent finished",
          //     status: "complete",
          //     ts: msg.data?.ts ?? Date.now()
          //   });
          // }
        }
      }
    } catch (err) {
      console.error("Adjudication failed", err);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(customerId);
        return next;
      });
    }
  };

  return (
    <WorkbenchLayout
      customers={userData}
      selectedUser={selectedUser}
      setSelectedUser={setSelectedUser}
      aiAnalysis={aiAnalysis}
      analysisResults={analysisResults}
      runAdjudication={() => runAdjudication(selectedUser, true)}
      isAnalyzing={isAnalyzing}
      rightPanelEvents={rightPanelEvents}
    >
      <EvidenceFeed
        articles={aiAnalysis?.articles || []}
        summaryData={summaryCardData}
      />
    </WorkbenchLayout>
  );
}
