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

type RightPanelEvent = {
  id: string;
  kind: "run" | "tool";
  title: string;
  status: "running" | "info" | "complete";
  ts: number;
};

type AnalysisResult = {
  analysis: AIAnalysis;
  summary: SummaryCardData | null;
  events: RightPanelEvent[];
};

export default function Home() {
  const [userData, setUserData] = useState<Record<string, ClientProfile>>({});
  const [selectedUser, setSelectedUser] = useState<string>("");

  // Caching State
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  const API_URL = 'https://sentinel-gva5.onrender.com'; // 'http://127.0.0.1:8000'; 

  // Derived State for Current View
  const currentResult = analysisResults[selectedUser];
  const aiAnalysis = currentResult?.analysis || null;
  const summaryCardData = currentResult?.summary || null;
  const isAnalyzing = analyzingIds.has(selectedUser);
  const rightPanelEvents = currentResult?.events ?? [];

  useEffect(() => {
    fetch(`${API_URL}/customers`)
      .then(response => response.json())
      .then((data: ClientProfile[]) => {
        const usersById = data.reduce((acc: Record<string, ClientProfile>, user) => {
          acc[user._id] = {
            ...user,
            address: typeof user.address === 'object' ? JSON.stringify(user.address) : user.address
          };
          return acc;
        }, {});

        if (data.length > 0) {
          setSelectedUser(data[0]._id);
        }
        setUserData(usersById);
      });
  }, []);

  // Auto-run analysis if not present
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

    // Reset
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
      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parsed = parseSSE(buffer);
        buffer = parsed.remainder;

        for (const msg of parsed.messages) {
          if (msg.event === "token") {
            accumulatedText += msg.data?.delta ?? "";

            setAnalysisResults(prev => {
              const cur: AnalysisResult = prev[customerId] ?? {
                analysis: { summary: "", confidence: 0, articles: [] },
                summary: null,
                events: []
              };

              return {
                ...prev,
                [customerId]: {
                  ...cur,
                  analysis: { ...cur.analysis, summary: accumulatedText }
                }
              };
            });
          }

          if (msg.event === "run_started") {
            setAnalysisResults(prev => {
              const cur: AnalysisResult = prev[customerId] ?? {
                analysis: { summary: "", confidence: 0, articles: [] },
                summary: null,
                events: []
              };

              return {
                ...prev,
                [customerId]: {
                  ...cur,
                  events: [
                    ...cur.events,
                    {
                      id: `run-${Date.now()}`,
                      kind: "run",
                      title: "Agent started",
                      status: "running",
                      ts: msg.data?.ts ?? Date.now()
                    }
                  ]
                }
              };
            });
          }

          if (msg.event === "tool_call_started") {
            const tool = msg.data?.tool ?? "Tool";
            const id = msg.data?.id ?? `${tool}-${Date.now()}`;

            setAnalysisResults(prev => {
              const cur: AnalysisResult = prev[customerId] ?? {
                analysis: { summary: "", confidence: 0, articles: [] },
                summary: null,
                events: []
              };

              // dedupe by id
              if (cur.events.some(e => e.id === id)) return prev;

              // Optional: prettier labels
              const prettyToolLabel: Record<string, string> = {
                search_news: "Adverse media search",
                get_customer_profile: "Database lookup",
                query_nessie: "Banking data lookup",
              };

              const title = prettyToolLabel[tool] ? `Calling ${prettyToolLabel[tool]}` : `Calling ${tool}`;

              return {
                ...prev,
                [customerId]: {
                  ...cur,
                  events: [
                    ...cur.events,
                    {
                      id,
                      kind: "tool",
                      title,
                      status: "info",
                      ts: msg.data?.ts ?? Date.now()
                    }
                  ]
                }
              };
            });
          }

          if (msg.event === "run_finished") {
            setAnalysisResults(prev => {
              const cur = prev[customerId];
              if (!cur) return prev;

              const events = [...cur.events];
              for (let i = events.length - 1; i >= 0; i--) {
                if (events[i].kind === "run" && events[i].status === "running") {
                  events[i] = { ...events[i], status: "complete", title: "Agent finished" };
                  break;
                }
              }

              return {
                ...prev,
                [customerId]: { ...cur, events }
              };
            });
          }

          // Forwarded Dedalus events (optional logging)
          if (msg.event === "event") {
            console.log("dedalus_event_raw", msg.data?.raw);
          }
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
