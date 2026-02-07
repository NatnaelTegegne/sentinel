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

  const exactMap: Record<string, string> = {
    "get_customer_profile": "Customer profile lookup",
    "query_nessie": "Banking database lookup",
    "search_news": "Adverse media search",

    "mcp-exa_search": "Web search (Exa)",
    "mcp-exa-search": "Web search (Exa)",
    "mcp_exa_search": "Web search (Exa)",
  };

  if (exactMap[raw]) return exactMap[raw];

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

  // Track case actions: "closed" or "escalated"
  const [caseActions, setCaseActions] = useState<Record<string, "closed" | "escalated">>({});

  const API_URL = "https://sentinel-gva5.onrender.com";

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

      // Raw stream (includes json block)
      let rawText = "";

      // What we have already rendered (display text, json stripped)
      let shownText = "";

      const pushEvent = (evt: RightPanelEvent) => {
        setAnalysisResults(prev => {
          const cur: AnalysisResult = prev[customerId] ?? {
            analysis: { summary: "", confidence: 0, articles: [] },
            summary: null,
            events: []
          };

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

      const appendTextDeltaToUI = (delta: string, ts: number) => {
        if (!delta) return;

        setAnalysisResults(prev => {
          const cur: AnalysisResult = prev[customerId] ?? {
            analysis: { summary: "", confidence: 0, articles: [] },
            summary: null,
            events: []
          };

          const events = [...cur.events];
          const last = events[events.length - 1];

          if (last && last.kind === "text") {
            events[events.length - 1] = { ...last, markdown: last.markdown + delta };
          } else {
            events.push({
              id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
              kind: "text",
              markdown: delta,
              ts
            });
          }

          return {
            ...prev,
            [customerId]: {
              ...cur,
              events
            }
          };
        });
      };

      const rebuildLatestTextCard = (fullDisplayText: string, ts: number, newSummaryData: SummaryCardData | null) => {
        setAnalysisResults(prev => {
          const cur: AnalysisResult = prev[customerId] ?? {
            analysis: { summary: "", confidence: 0, articles: [] },
            summary: null,
            events: []
          };

          const events = [...cur.events];

          // Find the most recent text event and set it to the full display text
          for (let i = events.length - 1; i >= 0; i--) {
            if (events[i].kind === "text") {
              events[i] = { ...(events[i] as any), markdown: fullDisplayText, ts };
              break;
            }
          }

          return {
            ...prev,
            [customerId]: {
              ...cur,
              events,
              analysis: {
                ...cur.analysis,
                summary: fullDisplayText,
                articles: newSummaryData?.articles || cur.analysis.articles
              },
              summary: newSummaryData || cur.summary
            }
          };
        });
      };

      const handleTokenDelta = (delta: string) => {
        if (!delta) return;
        rawText += delta;

        // Parse complete json block
        const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
        let displayText = rawText;
        let newSummaryData: SummaryCardData | null = null;

        if (jsonMatch) {
          try {
            newSummaryData = JSON.parse(jsonMatch[1]);
            displayText = rawText.replace(jsonMatch[0], "").trim();
          } catch {
            // incomplete JSON - still hide it
            displayText = rawText.replace(jsonMatch[0], "").trim();
          }
        } else {
          // Check if we're in the middle of a JSON block (started but not finished)
          const jsonStart = rawText.indexOf("```json");
          if (jsonStart !== -1) {
            // Hide everything from ```json onwards
            displayText = rawText.substring(0, jsonStart).trim();
          }
        }

        const ts = Date.now();

        // If displayText regressed (e.g., json removed content), rebuild latest text card once.
        // Also covers edge case where server replays content (shouldn't, but safe).
        if (!displayText.startsWith(shownText)) {
          shownText = displayText;

          // ensure there is at least one text card; if none, create it by pushing
          setAnalysisResults(prev => {
            const cur: AnalysisResult = prev[customerId] ?? {
              analysis: { summary: "", confidence: 0, articles: [] },
              summary: null,
              events: []
            };

            const hasText = cur.events.some(e => e.kind === "text");
            if (hasText) return prev;

            return {
              ...prev,
              [customerId]: {
                ...cur,
                events: [
                  ...cur.events,
                  {
                    id: `text-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    kind: "text",
                    markdown: "",
                    ts
                  }
                ]
              }
            };
          });

          // now rebuild the most recent text card to the full display text
          rebuildLatestTextCard(displayText, ts, newSummaryData);
          return;
        }

        // Normal case: append only the new delta portion
        const newPart = displayText.slice(shownText.length);
        if (newPart) {
          shownText = displayText;

          appendTextDeltaToUI(newPart, ts);

          // keep EvidenceFeed in sync
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
                analysis: {
                  ...cur.analysis,
                  summary: shownText,
                  articles: newSummaryData?.articles || cur.analysis.articles
                },
                summary: newSummaryData || cur.summary
              }
            };
          });
        } else if (newSummaryData) {
          // json parsed but no visible delta — still update summary card
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
                analysis: {
                  ...cur.analysis,
                  articles: newSummaryData?.articles || cur.analysis.articles
                },
                summary: newSummaryData
              }
            };
          });
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parsed = parseSSE(buffer);
        buffer = parsed.remainder;

        for (const msg of parsed.messages) {
          if (msg.event === "token") {
            handleTokenDelta(msg.data?.delta ?? "");
          }

          if (msg.event === "tool_call_started") {
            const rawTool = msg.data?.tool ?? "Tool";
            const toolId = msg.data?.id ?? `${rawTool}-${Date.now()}`;

            pushEvent({
              id: toolId,
              kind: "tool",
              title: `${prettyToolTitle(rawTool)}`, // no "Calling" prefix for the slimmer row
              status: "info",
              ts: Date.now(), // use client time for consistency
              rawToolName: rawTool
            });
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

  const handleCloseCase = () => {
    setCaseActions(prev => ({ ...prev, [selectedUser]: "closed" }));
  };

  const handleEscalate = () => {
    setCaseActions(prev => ({ ...prev, [selectedUser]: "escalated" }));
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
      caseActions={caseActions}
      onCloseCase={handleCloseCase}
      onEscalate={handleEscalate}
    >
      <EvidenceFeed
        articles={aiAnalysis?.articles || []}
        summaryData={summaryCardData}
      />
    </WorkbenchLayout>
  );
}
