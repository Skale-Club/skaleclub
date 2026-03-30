import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useXpotApp } from "./XpotContext";
import { formatDateTime, formatDuration } from "./utils";

export function XpotVisits() {
  const { visitsQuery } = useXpotApp();

  return (
    <div className="space-y-3">
      {visitsQuery.data?.length ? visitsQuery.data.map((visit) => (
        <Card key={visit.id} className="border-white/10 bg-white/5 text-white">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{visit.account?.name || `Account #${visit.accountId}`}</div>
              <Badge variant="secondary" className="bg-white/10 text-white">{visit.status}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-white/60">
              <div><div className="text-white/35">Check-in</div><div>{formatDateTime(visit.checkedInAt)}</div></div>
              <div><div className="text-white/35">Duration</div><div>{formatDuration(visit.durationSeconds)}</div></div>
            </div>
            {visit.note?.summary ? <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">{visit.note.summary}</div> : null}
          </CardContent>
        </Card>
      )) : <Card className="border-white/10 bg-white/5 text-white"><CardContent className="p-6 text-sm text-white/50">No visits recorded yet.</CardContent></Card>}
    </div>
  );
}
