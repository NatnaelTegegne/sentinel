import { cn } from "@/libf/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert } from "lucide-react";
import { Customer } from "@/app/data";

import { AIAnalysis } from "@/app/data";

interface SidebarProps {
    customers: Customer[];
    selectedUser: string;
    setSelectedUser: (id: string) => void;
    isAnalyzing: boolean;
    analysisResults?: Record<string, { analysis: AIAnalysis, summary: any }>;
}


export function Sidebar({
    customers,
    selectedUser,
    setSelectedUser,
    isAnalyzing,
    analysisResults
}: SidebarProps) {
    return (
        <div className="w-[300px] border-r bg-white flex flex-col h-full border-slate-200">
            {/* Header */}
            <div className="h-16 flex items-center px-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                        <ShieldAlert size={18} />
                    </div>
                    <span className="font-semibold text-slate-900 tracking-tight">Sentinel</span>
                </div>
                <div className="ml-auto">
                    <Avatar className="h-7 w-7">
                        <AvatarImage src="/avatar.png" />
                        <AvatarFallback className="bg-slate-100 text-xs text-slate-600">JD</AvatarFallback>
                    </Avatar>
                </div>
            </div>

            {/* Primary Nav */}
            <div className="px-3 pt-4 pb-2 flex-shrink-0 space-y-3">
                <Tabs defaultValue="my-queue" className="w-full">
                    <TabsList className="w-full grid grid-cols-1 bg-slate-100 h-8">
                        <TabsTrigger value="my-queue" className="text-xs">My Queue</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Queue List */}
            <div className="flex-1 min-h-0">
                <ScrollArea className="h-full px-3 pb-4">
                    <div className="space-y-2 mt-2">
                        {customers.map((customer) => {
                            const isSelected = customer._id === selectedUser;
                            const result = analysisResults?.[customer._id];
                            const summaryData = result?.summary;

                            // Determine status color if analyzed
                            let statusColor = "bg-slate-100 text-slate-500"; // Default/Pending
                            let statusText = "";

                            if (summaryData) {
                                if (summaryData.status === "Negative") {
                                    statusColor = "bg-green-100 text-green-700 border-green-200";
                                    statusText = "Clean";
                                } else if (summaryData.status === "Positive") {
                                    statusColor = "bg-red-100 text-red-700 border-red-200";
                                    statusText = "Risk";
                                }
                            }

                            return (
                                <div
                                    key={customer._id}
                                    className={cn(
                                        "p-3 rounded-lg border text-sm transition-colors relative flex gap-3 group",
                                        isSelected
                                            ? "bg-blue-50/60 border-blue-200"
                                            : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm"
                                    )}
                                    onClick={() => setSelectedUser(customer._id)}
                                >
                                    {isSelected && (
                                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-md" />
                                    )}

                                    <div className="flex-1 cursor-pointer">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="font-semibold text-slate-900">{customer.first_name} {customer.last_name}</span>
                                            {/* Status Badge */}
                                            {statusText && (
                                                <Badge variant="outline" className={cn("px-1.5 py-0 h-5 text-[10px] font-medium border", statusColor)}>
                                                    {statusText}
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 truncate max-w-[180px]">
                                                {customer.occupation || "Unknown Role"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
}
