import { useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Copy,
  Download,
  FileSignature,
  Mail,
  Plus,
  Printer,
} from "lucide-react";
import { LanguageContext } from "@/context/LanguageContext";
import { queryClient } from "@/lib/queryClient";
import { contractRequest, downloadContract } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ContractEditor } from "./contracts/ContractEditor";
import { SectionHeader } from "./shared/SectionHeader";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import type { CompanySettings } from "@shared/schema";
import type {
  ContractDraft,
  ContractEvent,
  ContractView,
} from "@shared/contracts";

type Summary = Omit<ContractView, "body" | "snapshot" | "receipt">;
type Text = (en: string, pt: string) => string;
const emptyDraft = (company?: CompanySettings): ContractDraft => ({
  title: "",
  body: "",
  companyName: company?.companyName ?? "Skale Club",
  companyEmail: company?.companyEmail ?? "",
  signerName: "",
  signerEmail: "",
  language: "en",
  expiresInDays: 30,
});

export function ContractsSection() {
  const language = useContext(LanguageContext)?.language ?? "en";
  const text: Text = (en, pt) => (language === "pt" ? pt : en);
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const { data: company } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });
  const list = useQuery({
    queryKey: ["/api/contracts", offset],
    queryFn: () =>
      contractRequest<{ data: Summary[]; total: number }>(
        `/api/contracts?offset=${offset}`,
      ),
    enabled: selected === null,
  });
  const detail = useQuery({
    queryKey: ["/api/contracts", selected],
    queryFn: () =>
      contractRequest<{ contract: ContractView; events: ContractEvent[] }>(
        `/api/contracts/${selected}`,
      ),
    enabled: selected !== null && selected !== "new",
  });
  const contract = detail.data?.contract;
  function choose(id: string | null) {
    setSelected(id);
    setError("");
    setNotice("");
    setReviewed(false);
    setDraftDirty(false);
    setPreview(false);
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      await queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const status = (row: Pick<ContractView, "status" | "expiresAt">) =>
    row.status === "sent" &&
    row.expiresAt &&
    Date.parse(row.expiresAt) < Date.now()
      ? text("Expired", "Expirado")
      : {
          draft: text("Draft", "Rascunho"),
          sent: text("Awaiting signature", "Aguardando assinatura"),
          signed: text("Signed", "Assinado"),
          voided: text("Voided", "Cancelado"),
        }[row.status];
  return (
    <div className="space-y-5" data-testid="contracts-section">
      <style>{`@media print { body * { visibility: hidden; } .contract-document, .contract-document * { visibility: visible; } .contract-document { position: absolute; left: 0; top: 0; width: 100%; border: 0; box-shadow: none; } @page { margin: 18mm; } }`}</style>
      <SectionHeader
        title={text("Contracts", "Contratos")}
        description={text(
          "Write, share and keep a record of signed agreements.",
          "Redija, compartilhe e guarde seus contratos assinados.",
        )}
        icon={<FileSignature className="h-5 w-5" />}
        action={
          selected === null ? (
            <Button data-testid="new-contract" onClick={() => choose("new")}>
              <Plus className="mr-2 h-4 w-4" />
              {text("New contract", "Novo contrato")}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => choose(null)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {text("All contracts", "Todos os contratos")}
            </Button>
          )
        }
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border bg-muted p-3 text-sm">
          {notice}
        </p>
      )}
      {selected === null ? (
        <>
          {list.isPending ? (
            <p role="status">
              {text("Loading contracts…", "Carregando contratos…")}
            </p>
          ) : list.isError ? (
            <div role="alert">
              {text(
                "Contracts could not be loaded. Check that the database migration has been applied.",
                "Não foi possível carregar os contratos. Verifique se a migração do banco foi aplicada.",
              )}
              <Button
                className="ml-3"
                variant="outline"
                onClick={() => void list.refetch()}
              >
                {text("Try again", "Tentar novamente")}
              </Button>
            </div>
          ) : list.data?.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <FileSignature className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <h2 className="font-semibold">
                {text(
                  "Your first agreement starts here",
                  "Seu primeiro contrato começa aqui",
                )}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {text(
                  "Create a contract, send the link and follow the signature from this panel.",
                  "Crie um contrato, envie o link e acompanhe a assinatura por este painel.",
                )}
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {list.data?.data.map((row) => (
                <button
                  className="flex w-full flex-col gap-2 p-5 text-left transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between"
                  key={row.id}
                  data-testid="contract-row"
                  onClick={() => choose(row.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {row.title}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {row.signerName} · {row.signerEmail}
                    </span>
                  </span>
                  <span
                    className={`w-fit shrink-0 rounded-full px-3 py-1 text-xs ${row.status === "signed" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}
                  >
                    {status(row)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {list.data && list.data.total > 25 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                {text("Previous", "Anterior")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}–{Math.min(offset + 25, list.data.total)} /{" "}
                {list.data.total}
              </span>
              <Button
                variant="outline"
                disabled={offset + 25 >= list.data.total}
                onClick={() => setOffset(offset + 25)}
              >
                {text("Next", "Próximo")}
              </Button>
            </div>
          )}
        </>
      ) : selected === "new" ? (
        <ContractEditor
          initial={emptyDraft(company)}
          busy={busy}
          text={text}
          onSave={(draft) =>
            void run(async () => {
              const row = await contractRequest<ContractView>(
                "/api/contracts",
                { method: "POST", body: draft },
              );
              choose(row.id);
            })
          }
        />
      ) : detail.isPending ? (
        <p role="status">{text("Loading…", "Carregando…")}</p>
      ) : detail.isError ? (
        <p role="alert">{detail.error.message}</p>
      ) : contract ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-muted px-3 py-1 text-sm">
              {status(contract)}
            </span>
            <span className="text-xs text-muted-foreground">{contract.id}</span>
          </div>
          {contract.status === "draft" ? (
            <>
              <ContractEditor
                key={`${contract.id}-${contract.version}`}
                initial={{
                  title: contract.title,
                  body: contract.body,
                  companyName: contract.companyName,
                  companyEmail: contract.companyEmail,
                  signerName: contract.signerName,
                  signerEmail: contract.signerEmail,
                  language: contract.language,
                  expiresInDays: contract.expiresInDays,
                }}
                version={contract.version}
                busy={busy}
                text={text}
                onDirty={() => {
                  setDraftDirty(true);
                  setReviewed(false);
                }}
                onSave={(draft) =>
                  void run(async () => {
                    await contractRequest(`/api/contracts/${contract.id}`, {
                      method: "PUT",
                      body: { ...draft, version: contract.version },
                    });
                    setDraftDirty(false);
                    setReviewed(false);
                    setNotice(text("Draft saved.", "Rascunho salvo."));
                  })
                }
              />
              <div className="space-y-4 rounded-xl border p-5">
                <h2 className="font-semibold">
                  {text("Ready to share?", "Pronto para compartilhar?")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {text(
                    "Creating the link freezes the last saved version below. Save your edits first. To change an issued contract, void it and create a new one.",
                    "Criar o link bloqueia a última versão salva abaixo. Salve suas alterações primeiro. Para mudar um contrato enviado, cancele-o e crie outro.",
                  )}
                </p>
                {draftDirty && (
                  <p role="status" className="text-sm font-medium">
                    {text(
                      "Save your changes before creating the link.",
                      "Salve suas alterações antes de criar o link.",
                    )}
                  </p>
                )}
                <Button variant="outline" onClick={() => setPreview(!preview)}>
                  {text("Review saved version", "Revisar versão salva")}
                </Button>
                {preview && <ContractDocument contract={contract} />}
                <label className="flex items-start gap-3 text-sm">
                  <input
                    className="mt-1"
                    type="checkbox"
                    checked={reviewed}
                    disabled={draftDirty}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  <span>
                    {text(
                      "I reviewed the saved contract and recipient email. I am ready to freeze this version.",
                      "Revisei o contrato salvo e o e-mail do destinatário. Quero bloquear esta versão.",
                    )}
                  </span>
                </label>
                <Button
                  disabled={busy || !reviewed || draftDirty}
                  data-testid="issue-contract"
                  onClick={() =>
                    void run(async () => {
                      await contractRequest(
                        `/api/contracts/${contract.id}/issue`,
                        { method: "POST", body: { version: contract.version } },
                      );
                      setNotice(
                        text(
                          "Link created. Copy it or send an email invitation below.",
                          "Link criado. Copie-o ou envie o convite por e-mail abaixo.",
                        ),
                      );
                    })
                  }
                >
                  {text("Create signing link", "Criar link de assinatura")}
                </Button>
              </div>
            </>
          ) : (
            <>
              {contract.sharePath && contract.status !== "voided" && (
                <div className="space-y-3 rounded-xl border p-5">
                  <label
                    className="block text-sm font-medium"
                    htmlFor="contract-link"
                  >
                    {text("Private signing link", "Link privado de assinatura")}
                  </label>
                  <Input
                    id="contract-link"
                    data-testid="contract-share-link"
                    readOnly
                    value={window.location.origin + contract.sharePath}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await navigator.clipboard.writeText(
                            window.location.origin + contract.sharePath,
                          );
                          setNotice(
                            text(
                              "Link copied. You can share it by text message or WhatsApp.",
                              "Link copiado. Você pode compartilhar por SMS ou WhatsApp.",
                            ),
                          );
                        })
                      }
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      {text("Copy link", "Copiar link")}
                    </Button>
                    {contract.status === "sent" && (
                      <Button
                        data-testid="invite-contract"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const result = await contractRequest<{
                              delivered: boolean;
                            }>(`/api/contracts/${contract.id}/invite`, {
                              method: "POST",
                            });
                            setNotice(
                              result.delivered
                                ? text("Invitation sent.", "Convite enviado.")
                                : text(
                                    "Email could not be sent. Configure Resend in Integrations, or copy the link. Email delivery must work for verification codes.",
                                    "Não foi possível enviar. Configure o Resend em Integrações ou copie o link. O envio de e-mail precisa funcionar para os códigos de confirmação.",
                                  ),
                            );
                          })
                        }
                      >
                        <Mail className="mr-2 h-4 w-4" />
                        {text("Email invitation", "Enviar convite por e-mail")}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      downloadContract(
                        `/api/contracts/${contract.id}/record`,
                        `contract-${contract.id}.html`,
                      ),
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  {text("Download copy", "Baixar cópia")}
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  {text("Print / save PDF", "Imprimir / salvar PDF")}
                </Button>
                {contract.receipt && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        downloadContract(
                          `/api/contracts/${contract.id}/evidence`,
                          `contract-${contract.id}-evidence.json`,
                        ),
                      )
                    }
                  >
                    {text("Download evidence", "Baixar evidências")}
                  </Button>
                )}
              </div>
              <ContractDocument contract={contract} />
              {contract.status === "sent" && (
                <details className="rounded-xl border p-4">
                  <summary className="cursor-pointer text-sm text-destructive">
                    {text("Void this contract", "Cancelar este contrato")}
                  </summary>
                  <p className="my-3 text-sm text-muted-foreground">
                    {text(
                      "This disables the signing link permanently. The record remains in your history.",
                      "Isso desativa a assinatura permanentemente. O registro permanece no histórico.",
                    )}
                  </p>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await contractRequest(
                          `/api/contracts/${contract.id}/void`,
                          { method: "POST" },
                        );
                      })
                    }
                  >
                    {text("Confirm void", "Confirmar cancelamento")}
                  </Button>
                </details>
              )}
            </>
          )}
          {contract.receipt && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const result = await contractRequest<{ delivered: boolean }>(
                    `/api/contracts/${contract.id}/copy`,
                    { method: "POST" },
                  );
                  setNotice(
                    result.delivered
                      ? text(
                          "Signed copy sent to both parties.",
                          "Cópia assinada enviada às duas partes.",
                        )
                      : text(
                          "Email delivery failed. The signed record remains saved. Check Resend in Integrations.",
                          "O envio falhou. O registro assinado continua salvo. Verifique o Resend em Integrações.",
                        ),
                  );
                })
              }
            >
              <Mail className="mr-2 h-4 w-4" />
              {text(
                "Email signed copy again",
                "Reenviar cópia assinada por e-mail",
              )}
            </Button>
          )}
          <details className="rounded-xl border p-5">
            <summary className="cursor-pointer font-medium">
              {text("Activity & evidence", "Histórico e evidências")}
            </summary>
            <ol className="mt-4 space-y-3">
              {detail.data?.events.map((event) => (
                <li key={event.id} className="border-l-2 pl-3 text-xs">
                  <p className="font-medium">{event.type.replace(/_/g, " ")}</p>
                  <p className="break-words text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString()} ·{" "}
                    {event.actor}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : null}
    </div>
  );
}
