import { ClientProfile, SummaryCardData } from "@/app/data";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Briefcase, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/libf/utils";

interface ClientHeaderProps {
    client: ClientProfile;
    onAnalyze?: () => void;
    isAnalyzing?: boolean;
    analysisStatus?: SummaryCardData;
}

export function ClientHeader({ client, onAnalyze, isAnalyzing, analysisStatus }: ClientHeaderProps) {
    // Improved parsing: treat as object if possible to preserve city/state in address
    let displayAddress = "";
    let displayAge = client.age;
    let displayOccupation = client.occupation;
    let displayCitizenship = client.citizenship;
    let displayTaxResidency = client.taxResidency;
    let displayTenure = client.tenure;
    let displayProducts = client.products;

    let addressParts: any[] = [];
    let source = client.address;

    if (typeof source === 'string' && source.trim().startsWith('{')) {
        try { source = JSON.parse(source); } catch (e) { }
    }

    if (typeof source === 'object' && source !== null) {
        addressParts = Object.values(source);
    } else {
        addressParts = [source];
    }

    const cleanParts = addressParts.map((part: any) => {
        const s = String(part);
        if (s.includes('||')) {
            const split = s.split('||');
            const main = split[0].trim();
            split.slice(1).forEach(m => {
                const lower = m.trim().toLowerCase();
                if (lower.startsWith('age:')) {
                    const val = m.split(':')[1]?.trim();
                    if (val) displayAge = parseInt(val);
                } else if (lower.startsWith('occupation:') || lower.startsWith('role:')) {
                    displayOccupation = m.split(':')[1]?.trim();
                } else if (lower.startsWith('citizen:') || lower.startsWith('citizenship:')) {
                    displayCitizenship = m.split(':')[1]?.trim();
                } else if (lower.startsWith('taxresidency:') || lower.startsWith('tax:')) {
                    displayTaxResidency = m.split(':')[1]?.trim();
                } else if (lower.startsWith('tenure:')) {
                    displayTenure = m.split(':')[1]?.trim();
                } else if (lower.startsWith('products:')) {
                    displayProducts = m.split(':')[1]?.split(',').map((p: string) => p.trim());
                }
            });
            return main;
        }
        return s;
    });

    displayAddress = cleanParts.join(", ");

    // Determine status badge based on backend output
    // Backend outputs: "YES" (adverse media found), "NO" (clear), or "MANUAL REVIEW"
    let statusColor = "bg-blue-100 text-blue-600 border-blue-200";
    let statusText = "Pending";

    if (analysisStatus) {
        const status = analysisStatus.status;

        if (status === "NO") {
            // No adverse media mentions
            statusColor = "bg-green-100 text-green-700 border-green-200";
            statusText = "Clear";
        } else if (status === "YES") {
            // Adverse media found
            statusColor = "bg-red-100 text-red-700 border-red-200";
            statusText = "Flagged";
        } else if (status === "MANUAL REVIEW") {
            // Manual review required
            statusColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
            statusText = "Review";
        }
    }


    return (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
            {/* Main Grid Layout */}
            <div className="grid grid-cols-4 gap-8 divide-x divide-slate-100 relative">

                {/* 1. ENTITY */}
                <div className="flex flex-col gap-1 pr-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        <User size={12} />
                        Entity
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                            {client.first_name} {client.last_name}
                        </h1>
                        <div className="flex flex-col items-start gap-1.5 mt-2">
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">
                                {client.id || client._id}
                            </span>
                            <Badge variant="outline" className={cn("px-2 py-0 h-5 text-[10px] font-medium border", statusColor)}>
                                {statusText}
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* 2. DEMOGRAPHICS */}
                <div className="flex flex-col gap-1 px-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Demographics
                    </div>
                    <div className="grid grid-cols-[60px_1fr] gap-y-1 text-sm">
                        <span className="text-slate-500">Age:</span>
                        <span className="font-medium text-slate-900">{displayAge || "--"}</span>

                        <span className="text-slate-500">Role:</span>
                        <span className="font-medium text-slate-900 truncate" title={displayOccupation}>{displayOccupation || "--"}</span>

                        <span className="text-slate-500">Citizen:</span>
                        <span className="font-medium text-slate-900">{displayCitizenship || "--"}</span>
                    </div>
                </div>

                {/* 3. LOCATION */}
                <div className="flex flex-col gap-1 px-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        <MapPin size={12} />
                        Location
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                        <div className="font-medium text-slate-900 line-clamp-2" title={displayAddress}>
                            {displayAddress}
                        </div>
                        <div className="flex gap-2 text-xs">
                            <span className="text-slate-500">Tax Residency:</span>
                            <span className="font-medium text-slate-700">{displayTaxResidency || "Same as Location"}</span>
                        </div>
                    </div>
                </div>

                {/* 4. RELATIONSHIP */}
                <div className="flex flex-col gap-1 pl-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        <Briefcase size={12} /> {/* Using Briefcase for Relationship context */}
                        Relationship
                    </div>
                    <div className="flex flex-col gap-2 text-sm">
                        <div className="flex gap-2">
                            <span className="text-slate-500">Tenure:</span>
                            <span className="font-medium text-slate-900">{displayTenure || "--"}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {displayProducts && displayProducts.length > 0 ? (
                                displayProducts.map((prod: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-medium rounded border border-blue-100">
                                        {prod}
                                    </span>
                                ))
                            ) : (
                                <span className="text-slate-400 text-xs italic">No products</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Action: Re-analyze Button - ABSOLUTE POSITIONED */}
                {onAnalyze && (
                    <div className="absolute top-0 right-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onAnalyze}
                            disabled={isAnalyzing}
                            className="h-8 w-8 p-0 text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900 bg-white"
                            title={isAnalyzing ? "Analyzing..." : "Re-analyze"}
                        >
                            <RefreshCw size={14} className={cn(isAnalyzing ? "animate-spin" : "")} />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
