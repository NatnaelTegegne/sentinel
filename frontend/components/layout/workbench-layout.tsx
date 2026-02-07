"use client";

import { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { ClientHeader } from "./client-header";
import { RightPanel } from "./right-panel";
import { Customer, AIAnalysis } from "@/app/data";
// In a real app, these would come from props or context

interface WorkbenchLayoutProps {
    children?: ReactNode;
    customers: Record<string, Customer>;
    selectedUser: string;
    setSelectedUser: (id: string) => void;
    aiAnalysis?: AIAnalysis | null;
    analysisResults?: Record<string, { analysis: AIAnalysis, summary: any }>;
    runAdjudication?: () => void;
    isAnalyzing: boolean;
}

export function WorkbenchLayout({
    children,
    customers,
    selectedUser,
    setSelectedUser,
    aiAnalysis,
    analysisResults,
    runAdjudication,
    isAnalyzing
}: WorkbenchLayoutProps) {
    if (!customers || !customers[selectedUser]) return <div className="p-10">Loading customers...</div>;

    const currentClient = customers[selectedUser];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900 selection:bg-blue-100">
            {/* Left Sidebar */}
            <Sidebar
                customers={Object.values(customers)}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                isAnalyzing={!!isAnalyzing}
                analysisResults={analysisResults}
            />

            {/* Main Stage */}
            <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                <ClientHeader
                    client={currentClient}
                    onAnalyze={runAdjudication}
                    isAnalyzing={isAnalyzing}
                />

                {/* Scrollable Content Area */}
                <main className="flex-1 overflow-y-auto scroll-smooth">
                    {children}
                </main>
            </div>

            {/* Right Panel */}
            <RightPanel
                analysis={aiAnalysis}
                runAdjudication={runAdjudication}
                isAnalyzing={isAnalyzing}
            />
        </div>
    );
}
