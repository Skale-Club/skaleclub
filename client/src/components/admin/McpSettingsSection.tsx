import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  rotatedAt: string | null;
}

function TokenRow({ token, onRotate, onDelete }: {
  token: ApiToken;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">{token.name}</span>
          {token.isActive ? (
            <Badge variant="outline" className="text-emerald-400 border-emerald-800 text-xs">active</Badge>
          ) : (
            <Badge variant="outline" className="text-zinc-500 border-zinc-700 text-xs">inactive</Badge>
          )}
        </div>
        <span className="text-xs text-zinc-500 font-mono">{token.tokenPrefix}••••••••••••••••••••••••••••••••••••••</span>
        <span className="text-xs text-zinc-600">
          Created {new Date(token.createdAt).toLocaleDateString()}
          {token.lastUsedAt && ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}`}
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onRotate(token.id)} className="text-xs">
          Rotate
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDelete(token.id)} className="text-xs text-red-400 border-red-900 hover:bg-red-950">
          Delete
        </Button>
      </div>
    </div>
  );
}

function RevealToken({ rawToken, mcpUrl }: { rawToken: string; mcpUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const copy = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="mt-4 p-4 bg-zinc-900 border border-yellow-700 rounded-lg space-y-3">
      <p className="text-sm text-yellow-400 font-medium">⚠ Copy this token now — it will never be shown again.</p>
      <div>
        <p className="text-xs text-zinc-400 mb-1">Bearer Token</p>
        <div className="flex gap-2">
          <Input value={rawToken} readOnly className="font-mono text-xs bg-zinc-950 border-zinc-700 text-white" />
          <Button size="sm" onClick={() => copy(rawToken, setCopied)} className="shrink-0">
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
      <div>
        <p className="text-xs text-zinc-400 mb-1">MCP Endpoint URL</p>
        <div className="flex gap-2">
          <Input value={mcpUrl} readOnly className="font-mono text-xs bg-zinc-950 border-zinc-700 text-white" />
          <Button size="sm" variant="outline" onClick={() => copy(mcpUrl, setCopiedUrl)} className="shrink-0">
            {copiedUrl ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button size="sm" variant="outline" onClick={copy} className={`shrink-0 gap-1.5 ${className ?? ""}`}>
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copiado!" : "Copiar"}
    </Button>
  );
}

export function McpSettingsSection() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<{ rawToken: string; mcpUrl: string } | null>(null);

  const mcpUrl = "https://skale.club/mcp";

  const { data: tokens = [], isLoading } = useQuery<ApiToken[]>({
    queryKey: ["/api/mcp/tokens"],
    queryFn: () => apiRequest("GET", "/api/mcp/tokens").then(r => r.json()),
  });

  const create = useMutation({
    mutationFn: (n: string) => apiRequest("POST", "/api/mcp/tokens", { name: n }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/mcp/tokens"] });
      setName("");
      setRevealed({ rawToken: data.rawToken, mcpUrl });
    },
  });

  const rotate = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/mcp/tokens/${id}/rotate`).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/mcp/tokens"] });
      setRevealed({ rawToken: data.rawToken, mcpUrl });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/mcp/tokens/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/mcp/tokens"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">MCP — Model Context Protocol</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Conecte o Claude Desktop ou Claude Code ao Skale Club para ler e editar estimates e presentations via MCP.
        </p>
      </div>

      {/* Connection URL */}
      <div className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg space-y-3">
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wider">URL de Conexão</p>
        <div className="flex items-center gap-2">
          <Input
            value={mcpUrl}
            readOnly
            className="font-mono text-sm bg-zinc-950 border-zinc-700 text-white"
          />
          <CopyButton text={mcpUrl} />
        </div>
        <div className="text-xs text-zinc-500 space-y-1">
          <p className="font-medium text-zinc-400">Como conectar no Claude Code:</p>
          <p>1. Gere um token abaixo e copie o Bearer Token</p>
          <p>2. No terminal: <code className="bg-zinc-800 px-1 rounded">claude mcp add skale-club https://skale.club/mcp --transport http --header "Authorization: Bearer SEU_TOKEN"</code></p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white">Generate New Token</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Token name (e.g. Claude Desktop)"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white"
          />
          <Button
            onClick={() => create.mutate(name)}
            disabled={!name.trim() || create.isPending}
            className="shrink-0"
          >
            {create.isPending ? "Generating…" : "Generate"}
          </Button>
        </div>
        {revealed && <RevealToken rawToken={revealed.rawToken} mcpUrl={mcpUrl} />}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-medium text-white">Active Tokens</h3>
        {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}
        {!isLoading && tokens.length === 0 && (
          <p className="text-sm text-zinc-500">No tokens yet. Generate one above.</p>
        )}
        {tokens.map(token => (
          <TokenRow
            key={token.id}
            token={token}
            onRotate={id => rotate.mutate(id)}
            onDelete={id => del.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}
