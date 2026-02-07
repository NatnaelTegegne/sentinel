'use client';

import { WorkbenchLayout } from "@/components/layout/workbench-layout";
import { EvidenceFeed } from "@/components/layout/evidence-feed";
import { ClientProfile, AIAnalysis, SummaryCardData } from "@/app/data";
import { useEffect, useState } from "react";

export default function Home() {
  const [userData, setUserData] = useState<Record<string, ClientProfile>>({});
  const [selectedUser, setSelectedUser] = useState<string>("");

  // Caching State
  const [analysisResults, setAnalysisResults] = useState<Record<string, { analysis: AIAnalysis, summary: SummaryCardData | null }>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());

  const API_URL = 'https://sentinel-gva5.onrender.com';

  // Derived State for Current View
  const currentResult = analysisResults[selectedUser];
  const aiAnalysis = currentResult?.analysis || null;
  const summaryCardData = currentResult?.summary || null;
  const isAnalyzing = analyzingIds.has(selectedUser);



  useEffect(() => {
    fetch(`${API_URL}/customers`)
      .then(response => response.json())
      .then((data: ClientProfile[]) => {
        const usersById = data.reduce((acc: Record<string, ClientProfile>, user) => {
          acc[user._id] = {
            ...user,
            // Ensure address is a string if it's an object, or keep it as is
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
  }, [selectedUser]);

  const runAdjudication = async (customerId: string, force = true) => {
    // If retrieving from cache and data exists, do nothing
    if (!force && analysisResults[customerId]) return;

    // Prevent double-run
    if (analyzingIds.has(customerId)) return;

    setAnalyzingIds(prev => {
      const next = new Set(prev);
      next.add(customerId);
      return next;
    });

    // Reset specifically for this customer
    setAnalysisResults(prev => ({
      ...prev,
      [customerId]: {
        analysis: { summary: "", confidence: 0, articles: [] },
        summary: null
      }
    }));

    try {
      const response = await fetch(`${API_URL}/adjudicate/${customerId}`);
      if (!response.body) throw new Error("ReadableStream not supported in this browser.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let accumulatedText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        accumulatedText += chunk;

        // Check for JSON block at the end
        const jsonMatch = accumulatedText.match(/```json\n([\s\S]*?)\n```/);
        let displayText = accumulatedText;
        let newSummaryData = null;

        if (jsonMatch) {
          try {
            newSummaryData = JSON.parse(jsonMatch[1]);
            // Remove JSON from display text
            displayText = accumulatedText.replace(jsonMatch[0], "").trim();
          } catch (e) {
            console.error("Failed to parse JSON summary", e);
          }
        }

        // Update results for this specific user
        setAnalysisResults(prev => {
          const current = prev[customerId] || { analysis: { summary: "", confidence: 0, articles: [] }, summary: null };
          return {
            ...prev,
            [customerId]: {
              analysis: {
                summary: displayText,
                confidence: current.analysis.confidence || 0,
                articles: current.analysis.articles || []
              },
              summary: newSummaryData || current.summary
            }
          };
        });
      }
    } catch (error) {
      console.error("Adjudication failed", error);
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
    >
      <EvidenceFeed
        articles={aiAnalysis?.articles || []}
        summaryData={summaryCardData}
      />
    </WorkbenchLayout>
  );
}
