// O que o blog custa — autoblog-parity SC-11.
//
// `ai_generation_logs` é escrito desde SC-08 sem nada lendo. Um registro de
// custo por chamada que ninguém consegue ver é só uma tabela que cresce.
//
// O número que decide se a publicação automática se paga é o gasto por post
// PUBLICADO, não o gasto total — o total cresce com a cadência escolhida, então
// responde outra pergunta.
import { useQuery } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { AdminCard } from '../shared';
import { Loader2 } from '@/components/ui/loader';

interface UsageRow {
  step: string;
  status: string;
  calls: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  avgDurationMs: number | null;
}

interface UsageResponse {
  days: number;
  rows: UsageRow[];
  totals: { calls: number; costUsd: number; inputTokens: number; outputTokens: number };
  /** null quando nada foi publicado na janela — um "ainda sem resposta"
   *  honesto em vez de uma divisão por zero disfarçada de $0,00. */
  costPerPost: number | null;
}

/** Quatro casas: uma chamada sozinha costuma custar menos de um centavo, e
 *  arredondar para duas mostraria toda linha como $0.00. */
function usd(value: number): string {
  return `$${value.toFixed(4)}`;
}

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-500/15 text-green-600 dark:text-green-400',
  failure: 'bg-red-500/15 text-red-600 dark:text-red-400',
  skipped: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
};

export function AiCostPanel() {
  const { data, isLoading } = useQuery<UsageResponse>({
    queryKey: ['/api/blog/ai-usage'],
  });

  return (
    <AdminCard>
      <div className="space-y-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <DollarSign className="h-4 w-4 text-primary" /> Custo de IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Quanto a publicação automática gastou, pelo custo que o próprio provedor reporta. Chamadas que falharam ou
            foram puladas entram na conta — vários provedores cobram por elas.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !data || data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma chamada de IA registrada ainda.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Últimos {data.days} dias</p>
                <p className="mt-1 text-2xl font-bold">{usd(data.totals.costUsd)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Por post publicado</p>
                <p className="mt-1 text-2xl font-bold">
                  {data.costPerPost === null ? '—' : usd(data.costPerPost)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Chamadas</p>
                <p className="mt-1 text-2xl font-bold">{data.totals.calls}</p>
              </div>
            </div>

            <div className="space-y-2">
              {data.rows.map((row) => (
                <div key={`${row.step}-${row.status}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.step}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status] ?? 'bg-muted text-muted-foreground'}`}>
                      {row.status}
                    </span>
                    <span className="text-sm text-muted-foreground">×{row.calls}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{usd(row.costUsd)}</span>
                    {row.inputTokens + row.outputTokens > 0 && <span>{row.inputTokens + row.outputTokens} tok</span>}
                    {row.avgDurationMs !== null && <span>{(row.avgDurationMs / 1000).toFixed(1)}s</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AdminCard>
  );
}
