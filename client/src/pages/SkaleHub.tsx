import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, Radio, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "@/components/ui/loader";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type HubActiveLive = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  hostName: string;
  timezone: string;
  startsAt: string | Date;
  endsAt: string | Date | null;
  registrationOpensAt: string | Date | null;
  registrationClosesAt: string | Date | null;
  status: string;
  hasReplay: boolean;
};

type HubActiveResponse = {
  live: HubActiveLive | null;
  message?: string;
};

type HubRegisterResponse = {
  unlocked: true;
  liveId: number;
  participantId: number;
  registrationId: number;
  access: {
    streamUrl: string | null;
    replayUrl: string | null;
  };
};

type HubAccessResponse = {
  granted: true;
  destinationUrl: string;
  liveId: number;
  participantId: number;
  registrationId: number;
  eventType: "join" | "replay";
};

function formatLiveDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatLiveTime(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

export default function SkaleHub() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [unlockData, setUnlockData] = useState<HubRegisterResponse | null>(null);

  const activeQuery = useQuery<HubActiveResponse>({
    queryKey: ["/api/skale-hub/active"],
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  const live = activeQuery.data?.live ?? null;

  useEffect(() => {
    if (!live || (unlockData && unlockData.liveId !== live.id)) {
      setUnlockData(null);
    }
  }, [live, unlockData]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/skale-hub/register", form);
      return response.json() as Promise<HubRegisterResponse>;
    },
    onSuccess: (data) => {
      setUnlockData(data);
      toast({
        title: "Registration confirmed",
        description: "You can now access the live.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to unlock access",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const accessMutation = useMutation({
    mutationFn: async () => {
      if (!unlockData) {
        throw new Error("Please complete registration first.");
      }

      const eventType = unlockData.access.streamUrl ? "join" : "replay";
      const response = await apiRequest("POST", `/api/skale-hub/${unlockData.liveId}/access`, {
        participantId: unlockData.participantId,
        eventType,
        metadata: { source: "public-page" },
      });

      return response.json() as Promise<HubAccessResponse>;
    },
    onSuccess: (data) => {
      window.open(data.destinationUrl, "_blank", "noopener,noreferrer");
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to open the live",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const liveMeta = useMemo(() => {
    if (!live) {
      return null;
    }

    return {
      date: formatLiveDate(live.startsAt),
      time: formatLiveTime(live.startsAt, live.timezone),
    };
  }, [live]);

  const canSubmit = form.name.trim().length > 0 && (form.phone.trim().length > 0 || form.email.trim().length > 0);
  const accessLabel = unlockData?.access.streamUrl ? "Access weekly live" : "Watch replay";

  return (
    <div className="bg-[linear-gradient(180deg,#f7f9fc_0%,#eef4ff_48%,#ffffff_100%)]">
      <section className="relative overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(64,110,241,0.18),transparent_58%),radial-gradient(circle_at_top_right,rgba(28,30,36,0.08),transparent_42%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#406EF1]/15 bg-white/80 px-4 py-2 text-sm font-semibold text-[#355CD0] shadow-sm backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Skale Hub by Skale Club
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Skale Hub
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                Skale Hub is Skale Club&apos;s weekly session for business owners who want to learn how to acquire clients in the United States using Google Ads, Meta Ads, Google Local Services, Thumbtack, Yelp, CRM, automation, and artificial intelligence.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-600">
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">Weekly live access</div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">US client acquisition</div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">Registration required</div>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <Card className="border-white/70 bg-white/80 shadow-lg shadow-[#406EF1]/5">
                  <CardContent className="flex items-center gap-3 p-5">
                    <Radio className="h-5 w-5 text-[#406EF1]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Live every week</p>
                      <p className="text-xs text-slate-500">Fresh tactical sessions</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/70 bg-white/80 shadow-lg shadow-[#406EF1]/5">
                  <CardContent className="flex items-center gap-3 p-5">
                    <Users className="h-5 w-5 text-[#406EF1]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Business focused</p>
                      <p className="text-xs text-slate-500">Built for growth-minded owners</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-white/70 bg-white/80 shadow-lg shadow-[#406EF1]/5">
                  <CardContent className="flex items-center gap-3 p-5">
                    <CheckCircle2 className="h-5 w-5 text-[#406EF1]" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Fast unlock</p>
                      <p className="text-xs text-slate-500">No account or password</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-6">
              <Card className="border-slate-200/80 bg-white/90 shadow-xl shadow-[#406EF1]/10">
                <CardHeader>
                  <CardTitle className="text-2xl text-slate-950">This week&apos;s live</CardTitle>
                  <CardDescription>
                    Access is released after a quick registration.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {activeQuery.isLoading ? (
                    <div className="flex min-h-[220px] items-center justify-center">
                      <Loader2 className="h-7 w-7 animate-spin text-[#406EF1]" />
                    </div>
                  ) : !live ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <p className="text-lg font-semibold text-slate-900">The next live will be announced soon.</p>
                      <p className="mt-2 text-sm text-slate-500">
                        We update Skale Hub every week with the next session on US client acquisition.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="rounded-2xl bg-[#18191f] p-6 text-white shadow-lg">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Skale Hub Weekly Live</p>
                        <h2 className="mt-3 text-2xl font-semibold leading-tight">{live.title}</h2>
                        <p className="mt-3 text-sm leading-6 text-white/72">
                          {live.description || "A practical weekly session on attracting and converting clients in the United States."}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/80">
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                            <CalendarDays className="h-4 w-4" />
                            {liveMeta?.date}
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                            <Clock3 className="h-4 w-4" />
                            {liveMeta?.time}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-sm font-semibold text-slate-900">Unlock the live link</p>
                        <p className="mt-1 text-sm text-slate-600">
                          Fill in your details and we&apos;ll release the access button right away.
                        </p>

                        <div className="mt-4 space-y-3">
                          <Input
                            placeholder="Your name"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                          />
                          <Input
                            placeholder="Phone"
                            value={form.phone}
                            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                          />
                          <Input
                            type="email"
                            placeholder="Email"
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                          />
                        </div>

                        <Button
                          className="mt-5 w-full bg-[#406EF1] hover:bg-[#355CD0]"
                          disabled={!canSubmit || registerMutation.isPending}
                          onClick={() => registerMutation.mutate()}
                        >
                          {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {registerMutation.isPending ? "Unlocking access..." : "Unlock live access"}
                        </Button>

                        {unlockData ? (
                          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                              <div className="space-y-3">
                                <div>
                                  <p className="font-semibold">Registration confirmed. You can now access the live.</p>
                                  <p className="mt-1 text-emerald-800/80">
                                    Your participation has been recorded and the access button is now available.
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  className="border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100"
                                  disabled={accessMutation.isPending || (!unlockData.access.streamUrl && !unlockData.access.replayUrl)}
                                  onClick={() => accessMutation.mutate()}
                                >
                                  {accessMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                                  {accessMutation.isPending ? "Opening..." : accessLabel}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
