import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Cpu, KeyRound, Loader2, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminCard, EmptyState, SectionHeader, SubSidebar, SubSidebarLayout } from "./shared";

const MCP_URL = "https://skale.club/mcp";
const CONNECT_CMD = `claude mcp add skale-club ${MCP_URL} --transport http --header "Authorization: Bearer YOUR_TOKEN"`;

const MCP_NAV: { id: "connection" | "tokens"; label: string; icon: typeof Plug }[] = [
  { id: "connection", label: "Connection", icon: Plug },
  { id: "tokens", label: "Tokens", icon: KeyRound },
];

type McpView = "connection" | "tokens";

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  rotatedAt: string | null;
}

function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button type="button" size="sm" variant="outline" onClick={copy} className={`shrink-0 gap-1.5 ${className ?? ""}`}>
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function RevealToken({ rawToken }: { rawToken: string }) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Your new token</p>
          <p className="text-sm text-muted-foreground">Copy it now. For security, it won't be shown again.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Input value={rawToken} readOnly className="font-mono text-xs" />
        <CopyButton text={rawToken} />
      </div>
    </div>
  );
}

function TokenRow({ token, onRotate, onDelete }: {
  token: ApiToken;
  onRotate: (t: ApiToken) => void;
  onDelete: (t: ApiToken) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <KeyRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{token.name}</span>
            {token.isActive
              ? <Badge variant="success">Active</Badge>
              : <Badge variant="secondary">Inactive</Badge>}
          </div>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {token.tokenPrefix}{"•".repeat(24)}
          </p>
          <p className="text-xs text-muted-foreground">
            Created {new Date(token.createdAt).toLocaleDateString()}
            {token.lastUsedAt ? ` · Last used ${new Date(token.lastUsedAt).toLocaleDateString()}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => onRotate(token)}>
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Rotate</span>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          title="Delete token"
          onClick={() => onDelete(token)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

type ConfirmTarget = { token: ApiToken; mode: "rotate" | "delete" };

export function McpSettingsSection({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [activeView, setActiveView] = useState<McpView>("connection");

  const { data: tokens = [], isLoading } = useQuery<ApiToken[]>({
    queryKey: ["/api/mcp/tokens"],
    queryFn: () => apiRequest("GET", "/api/mcp/tokens").then(r => r.json()),
  });

  const create = useMutation({
    mutationFn: (n: string) => apiRequest("POST", "/api/mcp/tokens", { name: n }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/mcp/tokens"] });
      setName("");
      setRevealed(data.rawToken);
      toast({ title: "Token generated" });
    },
    onError: (e: any) => toast({ title: "Could not generate token", description: e?.message, variant: "destructive" }),
  });

  const rotate = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/mcp/tokens/${id}/rotate`).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/mcp/tokens"] });
      setRevealed(data.rawToken);
      toast({ title: "Token rotated" });
    },
    onError: (e: any) => toast({ title: "Could not rotate token", description: e?.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/mcp/tokens/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/mcp/tokens"] });
      toast({ title: "Token deleted" });
    },
    onError: (e: any) => toast({ title: "Could not delete token", description: e?.message, variant: "destructive" }),
  });

  const confirmAction = () => {
    if (!confirmTarget) return;
    if (confirmTarget.mode === "rotate") rotate.mutate(confirmTarget.token.id);
    else del.mutate(confirmTarget.token.id);
    setConfirmTarget(null);
  };

  const connectionPanel = (
    <AdminCard className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Connection</h3>
        <p className="text-sm text-muted-foreground">
          Connect Claude Desktop or Claude Code to Skale Club to read and edit estimates and presentations over MCP.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connection URL</p>
        <div className="flex gap-2">
          <Input value={MCP_URL} readOnly className="font-mono text-sm" />
          <CopyButton text={MCP_URL} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground">How to connect in Claude Code</p>
        <ol className="space-y-2.5 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">1</span>
            Generate a token below and copy the Bearer token.
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">2</span>
            Run this command in your terminal:
          </li>
        </ol>
        <div className="flex items-stretch gap-2">
          <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-muted px-3 py-2.5 font-mono text-xs text-foreground">
            {CONNECT_CMD}
          </code>
          <CopyButton text={CONNECT_CMD} />
        </div>
      </div>
    </AdminCard>
  );

  const tokensPanel = (
    <div className="space-y-6">
      <AdminCard className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Generate a new token</h3>
          <p className="text-sm text-muted-foreground">Give it a recognizable name so you can revoke it later.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Token name (e.g. Claude Desktop)"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && name.trim() && !create.isPending) create.mutate(name); }}
            className="flex-1"
          />
          <Button onClick={() => create.mutate(name)} disabled={!name.trim() || create.isPending} className="shrink-0 gap-1.5">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Generate
          </Button>
        </div>
        {revealed && <RevealToken rawToken={revealed} />}
      </AdminCard>

      <AdminCard className="space-y-1">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Active tokens</h3>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tokens…
          </div>
        ) : tokens.length === 0 ? (
          <EmptyState
            icon={<KeyRound />}
            title="No tokens yet"
            description="Generate a token above to connect an AI agent to Skale Club."
          />
        ) : (
          <div>
            {tokens.map(token => (
              <TokenRow
                key={token.id}
                token={token}
                onRotate={(t) => setConfirmTarget({ token: t, mode: "rotate" })}
                onDelete={(t) => setConfirmTarget({ token: t, mode: "delete" })}
              />
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );

  return (
    <div className="space-y-6">
      {!embedded && (
        <SectionHeader
          title="MCP"
          description="Token-based access for AI agents to read and edit estimates and presentations."
          icon={<Cpu className="h-5 w-5" />}
        />
      )}

      {embedded ? (
        <div className="space-y-6">
          {connectionPanel}
          {tokensPanel}
        </div>
      ) : (
        <SubSidebarLayout
          nav={
            <SubSidebar
              items={MCP_NAV}
              value={activeView}
              onValueChange={(id) => setActiveView(id as McpView)}
              storageKey="mcp"
            />
          }
        >
          {activeView === "connection" && connectionPanel}
          {activeView === "tokens" && tokensPanel}
        </SubSidebarLayout>
      )}

      {/* Confirm rotate / delete */}
      {confirmTarget && (
        <AlertDialog open onOpenChange={(o) => !o && setConfirmTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmTarget.mode === "rotate" ? "Rotate this token?" : "Delete this token?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmTarget.mode === "rotate"
                  ? `The current secret for "${confirmTarget.token.name}" stops working immediately and a new one is issued. Any agent using the old token must be updated.`
                  : `"${confirmTarget.token.name}" will be permanently revoked. Any agent using it loses access. This cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmAction}
                className={confirmTarget.mode === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              >
                {confirmTarget.mode === "rotate" ? "Rotate" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
