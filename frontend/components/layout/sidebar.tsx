"use client";

import { cn } from "@/libf/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert } from "lucide-react";
import { Customer } from "@/app/data";

interface SidebarProps {
    customers: Customer[];
    selectedUser: string;
    setSelectedUser: any;
}


export function Sidebar({ customers, selectedUser, setSelectedUser }: SidebarProps) {
    return (
        <div className="w-[280px] border-r bg-white flex flex-col h-full border-slate-200">
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
            <div className="px-3 pt-4 pb-2 flex-shrink-0">
                <Tabs defaultValue="my-queue" className="w-full">
                    <TabsList className="w-full grid grid-cols-3 bg-slate-100 h-8">
                        <TabsTrigger value="my-queue" className="text-xs">My Queue</TabsTrigger>
                        <TabsTrigger value="team" className="text-xs">Team</TabsTrigger>
                        <TabsTrigger value="closed" className="text-xs">Closed</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Queue List */}
            <ScrollArea className="flex-1 px-3 pb-4">
                <div className="space-y-2 mt-2">
                    {customers.map((customer) => {
                        const isSelected = customer._id === selectedUser;
                        const alertType = "Adverse Media"; // This could be dynamic later

                        return (
                            <div
                                key={customer._id}
                                className={cn(
                                    "p-3 rounded-lg border text-sm cursor-pointer transition-colors relative",
                                    isSelected
                                        ? "bg-blue-50/60 border-blue-200"
                                        : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm"
                                )}
                                onClick={() => { setSelectedUser(customer._id) }}
                            >
                                {isSelected && (
                                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-blue-500 rounded-r-md" />
                                )}

                                <div className="flex justify-between items-start mb-1.5 ml-1">
                                    <span className="font-semibold text-slate-900">{customer.first_name} {customer.last_name}</span>
                                    {isSelected && <span className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />}
                                </div>

                                <div className="flex items-center gap-2 ml-1">
                                    <Badge variant="outline" className={cn(
                                        "px-1.5 py-0 h-5 text-[10px] font-medium border-0",
                                        alertType === "Adverse Media"
                                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                            : "bg-red-50 text-red-700 ring-1 ring-red-200"
                                    )}>
                                        {alertType}
                                    </Badge>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
