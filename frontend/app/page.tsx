'use client';

import { WorkbenchLayout } from "@/components/layout/workbench-layout";
import { EvidenceFeed } from "@/components/layout/evidence-feed";
import { ClientProfile, AIAnalysis } from "@/app/data";
import { useEffect, useState } from "react";

export default function Home() {
  const [userData, setUserData] = useState<Record<string, ClientProfile>>({});
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [summaryCardData, setSummaryCardData] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

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

  const runAdjudication = async (customerId: string) => {
    setIsAnalyzing(true);
    setAiAnalysis({ summary: "", confidence: 0, articles: [] }); // Reset
    setSummaryCardData(null); // Reset summary card

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

        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            setSummaryCardData(jsonData);
            // Remove JSON from display text
            displayText = accumulatedText.replace(jsonMatch[0], "").trim();
          } catch (e) {
            console.error("Failed to parse JSON summary", e);
          }
        }

        // Simple update for now - pushing raw text to summary
        setAiAnalysis(prev => ({
          summary: displayText,
          confidence: prev?.confidence || 0,
          articles: prev?.articles || []
        }));
      }
    } catch (error) {
      console.error("Adjudication failed", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <WorkbenchLayout
      customers={userData}
      selectedUser={selectedUser}
      setSelectedUser={setSelectedUser}
      aiAnalysis={aiAnalysis}
      runAdjudication={() => runAdjudication(selectedUser)}
      isAnalyzing={isAnalyzing}
    >
      <EvidenceFeed
        articles={aiAnalysis?.articles || []}
        summaryData={summaryCardData}
      />
    </WorkbenchLayout>
  );
}
