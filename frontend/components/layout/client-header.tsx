import { ClientProfile } from "@/app/data";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Briefcase } from "lucide-react";
import { cn } from "@/libf/utils";

interface ClientHeaderProps {
    client: ClientProfile;
}

export function ClientHeader({ client }: ClientHeaderProps) {
    const locationString = typeof client.address === 'string' && client.address.startsWith('{')
        ? Object.values(JSON.parse(client.address)).join(", ")
        : typeof client.address === 'object'
            ? Object.values(client.address).join(", ")
            : client.address;

    return (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {client.first_name} {client.last_name}
                        </h1>
                        <Badge variant="outline" className={cn(
                            "text-[10px] px-2 h-5 border",
                            client.riskRating === 'Low' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                client.riskRating === 'High' ? "bg-red-50 text-red-700 border-red-200" :
                                    "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                            {client.riskRating} Risk
                        </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">
                                {client.id}
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Briefcase size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-700">{client.occupation}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <MapPin size={14} className="text-slate-400" />
                            <span>{locationString}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
