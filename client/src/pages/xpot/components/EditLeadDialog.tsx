import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SalesLead, FullSalesLead } from "../types";

type LeadLike = SalesLead | FullSalesLead;

function label(text: string) {
  return <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">{text}</div>;
}

export function EditLeadDialog({ lead, open, onOpenChange, onSaved }: {
  lead: LeadLike;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const loc = (lead as FullSalesLead).locations?.[0];
  const [form, setForm] = useState({
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    website: lead.website || "",
    industry: lead.industry || "",
    addressLine1: loc?.addressLine1 || "",
    city: loc?.city || "",
    state: loc?.state || "",
    postalCode: loc?.postalCode || "",
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/xpot/leads/${lead.id}`, {
        name: form.name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        website: form.website || undefined,
        industry: form.industry || undefined,
        primaryLocation: (form.addressLine1 || form.city || form.state) ? {
          addressLine1: form.addressLine1 || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          postalCode: form.postalCode || undefined,
        } : undefined,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Lead updated", variant: "success" });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update lead", description: error.message, variant: "destructive" });
    },
  });

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            {label("Business")}
            <Input value={form.name} onChange={f("name")} placeholder="Business name" />
          </div>

          <div>
            {label("Contact")}
            <div className="space-y-2">
              <Input value={form.phone} onChange={f("phone")} placeholder="Phone" />
              <Input value={form.email} onChange={f("email")} placeholder="Email" />
              <Input value={form.website} onChange={f("website")} placeholder="Website" />
            </div>
          </div>

          <div>
            {label("Details")}
            <Input value={form.industry} onChange={f("industry")} placeholder="Industry" />
          </div>

          <div>
            {label("Address")}
            <div className="space-y-2">
              <Input value={form.addressLine1} onChange={f("addressLine1")} placeholder="Street address" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={form.city} onChange={f("city")} placeholder="City" />
                <Input value={form.state} onChange={f("state")} placeholder="State" />
              </div>
              <Input value={form.postalCode} onChange={f("postalCode")} placeholder="Postal code" />
            </div>
          </div>

          <Button className="w-full" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
            {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
