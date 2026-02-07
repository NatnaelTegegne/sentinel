import { ClientProfile } from "@/app/data";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Briefcase, CreditCard } from "lucide-react";

interface ClientHeaderProps {
    client: ClientProfile;
}

export function ClientHeader({ client }: ClientHeaderProps) {
    return (
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm">
            <div className="grid grid-cols-4 gap-4">
                {/* Col 1: Entity */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                        <User size={14} />
                        Entity
                    </div>
                    <div className="font-bold text-slate-900 text-lg leading-tight">{client.first_name} {client.last_name}</div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{client.id}</span>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] px-1.5 h-5">
                            {client.riskRating} Risk
                        </Badge>
                    </div>
                </div>

                {/* Col 2: Demographics */}
                <div className="space-y-1 border-l border-slate-100 pl-4">
                    <div className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Demographics</div>
                    <div className="grid grid-cols-2 gap-x-2 text-sm">
                        <span className="text-slate-500">Age:</span>
                        <span className="font-medium text-slate-900">{client.age}</span>
                        <span className="text-slate-500">Role:</span>
                        <span className="font-medium text-slate-900">{client.occupation}</span>
                        <span className="text-slate-500">Citizen:</span>
                        <span className="font-medium text-slate-900">{client.citizenship}</span>
                    </div>
                </div>

                {/* Col 3: Location */}
                <div className="space-y-1 border-l border-slate-100 pl-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                        <MapPin size={14} />
                        Location
                    </div>
                    <div className="text-sm font-medium text-slate-900">
                        {typeof client.address === 'string' && client.address.startsWith('{')
                            ? Object.values(JSON.parse(client.address)).join(" ")
                            : typeof client.address === 'object'
                                ? Object.values(client.address).join(" ")
                                : client.address}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">Tax Residency: <span className="text-slate-700 font-medium">{client.taxResidency}</span></div>
                </div>

                {/* {/ Col 4: Relationship /}
                <div className="space-y-1 border-l border-slate-100 pl-4">
                    <div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                        <CreditCard size={14} />
                        Relationship
                    </div>
                    <div className="text-sm">
                        <span className="text-slate-500">Tenure:</span> <span className="font-medium text-slate-900">{client.tenure}</span>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                        {client.products.map(p => (
                            <span key={p} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium border border-blue-100">
                                {p}
                            </span>
                        ))}
                    </div>
                </div> */}
            </div>
        </div>
    );
}
