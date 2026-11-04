import { useState } from "react";
import type { ContractDraft } from "@shared/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
type Text = (en: string, pt: string) => string;

export function ContractEditor({
  initial,
  version,
  busy,
  onSave,
  onDirty,
  text,
}: {
  initial: ContractDraft;
  version?: number;
  busy: boolean;
  onSave: (draft: ContractDraft) => void;
  onDirty?: () => void;
  text: Text;
}) {
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof ContractDraft>(
    key: K,
    value: ContractDraft[K],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    onDirty?.();
  };
  return (
    <form
      className="space-y-5"
      data-testid="contract-editor"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium sm:col-span-2">
          {text("Contract title", "Título do contrato")}
          <Input
            data-testid="contract-title"
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            minLength={3}
            maxLength={200}
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          {text("Company name", "Nome da empresa")}
          <Input
            value={draft.companyName}
            onChange={(e) => set("companyName", e.target.value)}
            minLength={2}
            maxLength={200}
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          {text("Company contact email", "E-mail de contato da empresa")}
          <Input
            data-testid="contract-company-email"
            type="email"
            value={draft.companyEmail}
            onChange={(e) => set("companyEmail", e.target.value)}
            maxLength={254}
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          {text("Signer’s full name", "Nome completo de quem assina")}
          <Input
            data-testid="contract-signer-name"
            value={draft.signerName}
            onChange={(e) => set("signerName", e.target.value)}
            minLength={2}
            maxLength={200}
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          {text("Signer’s email", "E-mail de quem assina")}
          <Input
            data-testid="contract-signer-email"
            type="email"
            value={draft.signerEmail}
            onChange={(e) => set("signerEmail", e.target.value)}
            maxLength={254}
            required
          />
        </label>
        <label className="space-y-2 text-sm font-medium">
          {text("Signing language", "Idioma da assinatura")}
          <select
            className="flex h-10 w-full rounded-md border bg-background px-3"
            value={draft.language}
            onChange={(e) => set("language", e.target.value as "en" | "pt")}
          >
            <option value="en">English</option>
            <option value="pt">Português</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          {text("Link expires after (days)", "Link expira após (dias)")}
          <Input
            type="number"
            min={1}
            max={90}
            value={draft.expiresInDays}
            onChange={(e) => set("expiresInDays", Number(e.target.value))}
            required
          />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium">
        {text("Contract text", "Texto do contrato")}
        <Textarea
          data-testid="contract-body"
          className="min-h-[360px] leading-7"
          value={draft.body}
          onChange={(e) => set("body", e.target.value)}
          minLength={20}
          maxLength={100_000}
          placeholder={text(
            "Write the complete agreement: services, payment, responsibilities, deadlines and termination terms.",
            "Escreva o acordo completo: serviços, pagamento, responsabilidades, prazos e condições de encerramento.",
          )}
          required
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {text(
          "One recipient per contract. The company’s details identify the sender; this flow records the recipient’s signature only.",
          "Um destinatário por contrato. Os dados da empresa identificam o remetente; este fluxo registra apenas a assinatura do destinatário.",
        )}
      </p>
      <Button data-testid="save-contract" disabled={busy}>
        {busy
          ? text("Saving…", "Salvando…")
          : version
            ? text("Save draft", "Salvar rascunho")
            : text("Create draft", "Criar rascunho")}
      </Button>
    </form>
  );
}
