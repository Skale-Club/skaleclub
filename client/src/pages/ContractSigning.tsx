import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  CheckCircle2,
  Download,
  LockKeyhole,
  Mail,
  Printer,
  ShieldCheck,
} from "lucide-react";
import type { ContractView, SigningGate } from "@shared/contracts";
import { ContractDocument } from "@/components/contracts/ContractDocument";
import { contractRequest, downloadContract } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ContractSigning() {
  const [, params] = useRoute("/contracts/:id");
  const id = params?.id ?? "";
  const [token] = useState(() => window.location.hash.slice(1));
  const [gate, setGate] = useState<SigningGate | null>(null);
  const [contract, setContract] = useState<ContractView | null>(null);
  // Verification credentials stay in memory: no localStorage, cookies or query cache.
  const [challenge, setChallenge] = useState("");
  const [access, setAccess] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copyDelivered, setCopyDelivered] = useState<boolean | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const pt = gate?.language === "pt";
  const text = (en: string, br: string) => (pt ? br : en);
  const endpoint = `/api/signing/${id}`;
  useEffect(() => {
    let alive = true;
    if (!token) {
      setError(
        "This link is incomplete. Open the full link from your invitation. / Abra o link completo recebido no convite.",
      );
      setLoading(false);
      return;
    }
    contractRequest<SigningGate>(endpoint, { token })
      .then((data) => {
        if (alive) setGate(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [endpoint, token]);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const unavailable = gate?.status === "expired" || gate?.status === "voided";
  const wait = Math.max(0, Math.ceil((retryAt - clock) / 1000));
  return (
    <main
      className="min-h-screen bg-slate-50 text-slate-900"
      lang={pt ? "pt" : "en"}
    >
      <style>{`@media print { body { background: white !important; } .signing-controls, .signing-header { display: none !important; } .contract-document { border: 0; box-shadow: none; padding: 0; } .signing-layout { display: block !important; max-width: none !important; padding: 0 !important; } @page { margin: 18mm; } }`}</style>
      <header className="signing-header border-b border-slate-200 bg-white px-5 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <span className="font-semibold tracking-tight">
            {gate?.companyName ?? "Skale Club"}
          </span>
          <span className="flex items-center gap-2 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4" />
            {text("Electronic signature", "Assinatura eletrônica")}
          </span>
        </div>
      </header>
      <div
        className={`signing-layout mx-auto max-w-5xl px-4 py-8 sm:px-6 ${contract ? "grid items-start gap-6 lg:grid-cols-[1fr_300px]" : ""}`}
      >
        {contract && <ContractDocument contract={contract} />}
        <section
          className={`signing-controls rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${contract ? "lg:sticky lg:top-6" : "mx-auto mt-8 max-w-md"}`}
        >
          {loading ? (
            <p role="status">Loading / Carregando…</p>
          ) : unavailable ? (
            <>
              <LockKeyhole className="mb-4 h-8 w-8 text-slate-500" />
              <h1 className="text-xl font-semibold">
                {text(
                  "This link is unavailable",
                  "Este link está indisponível",
                )}
              </h1>
              <p className="mt-3 text-sm text-slate-600">
                {text(
                  "The contract expired or was voided. Contact the company for a new document.",
                  "O contrato expirou ou foi cancelado. Entre em contato com a empresa para receber um novo documento.",
                )}
              </p>
            </>
          ) : !contract && gate ? (
            <>
              <Mail className="mb-4 h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-semibold">
                {text("Confirm your email", "Confirme seu e-mail")}
              </h1>
              <p className="my-4 text-sm leading-6 text-slate-600">
                {text(
                  "To review and sign your contract, we will send a code to",
                  "Para ler e assinar o contrato, enviaremos um código para",
                )}{" "}
                <strong className="break-all text-slate-900">
                  {gate.maskedEmail}
                </strong>
                .
              </p>
              {challenge && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(async () => {
                      const result = await contractRequest<{
                        accessToken: string;
                        contract: ContractView;
                      }>(`${endpoint}/verify`, {
                        method: "POST",
                        token,
                        body: { challengeToken: challenge, code },
                      });
                      setAccess(result.accessToken);
                      setContract(result.contract);
                    });
                  }}
                >
                  <label
                    htmlFor="signing-code"
                    className="mb-2 block text-sm font-medium"
                  >
                    {text("6-digit code", "Código de 6 dígitos")}
                  </label>
                  <Input
                    id="signing-code"
                    data-testid="signing-code"
                    className="border-slate-300 bg-white text-slate-900"
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    required
                  />
                  <Button
                    className="mt-3 w-full bg-blue-600 text-white hover:bg-blue-700"
                    disabled={busy || code.length !== 6}
                    data-testid="verify-code"
                  >
                    {text("Open contract", "Abrir contrato")}
                  </Button>
                </form>
              )}
              <Button
                variant={challenge ? "outline" : "default"}
                className={`mt-4 w-full ${challenge ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-100" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                disabled={busy || wait > 0}
                data-testid="request-code"
                onClick={() =>
                  void action(async () => {
                    const result = await contractRequest<{
                      challengeToken: string;
                    }>(`${endpoint}/code`, { method: "POST", token });
                    setChallenge(result.challengeToken);
                    setRetryAt(Date.now() + 60_000);
                    setClock(Date.now());
                  })
                }
              >
                {wait > 0
                  ? `${text("Resend in", "Reenviar em")} ${wait}s`
                  : text(
                      challenge ? "Resend code" : "Send verification code",
                      challenge
                        ? "Reenviar código"
                        : "Enviar código de confirmação",
                    )}
              </Button>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                {text(
                  "You do not need to create an account. Your contract stays private until your email is confirmed.",
                  "Você não precisa criar uma conta. O conteúdo fica protegido até a confirmação do e-mail.",
                )}
              </p>
            </>
          ) : contract?.status === "signed" ? (
            <>
              <CheckCircle2 className="mb-4 h-9 w-9 text-emerald-600" />
              <h2 className="text-xl font-semibold">
                {text("Contract signed", "Contrato assinado")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {text(
                  "Your signed document has been saved. Download a copy for your records.",
                  "Seu documento assinado foi salvo. Baixe uma cópia para guardar.",
                )}
              </p>
              {copyDelivered !== null && (
                <p className="mt-3 text-sm">
                  {copyDelivered
                    ? text(
                        "A copy was also sent to both parties by email.",
                        "Uma cópia também foi enviada por e-mail às duas partes.",
                      )
                    : text(
                        "Email delivery could not be confirmed. Your signed record is saved and can be downloaded here.",
                        "Não foi possível confirmar o envio por e-mail. O registro está salvo e pode ser baixado aqui.",
                      )}
                </p>
              )}
            </>
          ) : contract ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  const result = await contractRequest<{
                    contract: ContractView;
                    copyDelivered: boolean;
                  }>(`${endpoint}/sign`, {
                    method: "POST",
                    token,
                    access,
                    body: {
                      typedName: name,
                      documentHash: contract.documentHash,
                      consent,
                    },
                  });
                  setContract(result.contract);
                  setCopyDelivered(result.copyDelivered);
                });
              }}
            >
              <h2 className="text-xl font-semibold">
                {text("Review and sign", "Revise e assine")}
              </h2>
              <p className="my-3 text-sm text-slate-600">
                {text(
                  "Read the entire contract before signing. Questions? Contact",
                  "Leia o contrato inteiro antes de assinar. Dúvidas? Contate",
                )}{" "}
                <a
                  className="break-all text-blue-700 underline"
                  href={`mailto:${contract.companyEmail}`}
                >
                  {contract.companyEmail}
                </a>
                .
              </p>
              <label
                htmlFor="signature-name"
                className="mb-2 block text-sm font-medium"
              >
                {text("Your full name", "Seu nome completo")}
              </label>
              <Input
                id="signature-name"
                data-testid="signature-name"
                className="border-slate-300 bg-white text-slate-900"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={contract.signerName}
                maxLength={200}
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                {text(
                  "Type your name exactly as shown in the contract.",
                  "Digite seu nome como aparece no contrato.",
                )}
              </p>
              <label className="mt-5 flex items-start gap-3 text-xs leading-5">
                <input
                  type="checkbox"
                  data-testid="signing-consent"
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                />
                <span>{contract.snapshot?.consent}</span>
              </label>
              <Button
                className="mt-5 w-full bg-blue-600 text-white hover:bg-blue-700"
                data-testid="sign-contract"
                disabled={busy || !consent || name.trim().length < 2}
              >
                {busy
                  ? text("Saving…", "Salvando…")
                  : text(
                      "Agree and sign contract",
                      "Concordar e assinar contrato",
                    )}
              </Button>
            </form>
          ) : null}
          {contract && (
            <div className="mt-6 space-y-2 border-t border-slate-200 pt-4">
              <Button
                variant="outline"
                className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                disabled={busy}
                data-testid="download-record"
                onClick={() =>
                  void action(() =>
                    downloadContract(
                      `${endpoint}/record`,
                      `contract-${id}.html`,
                      token,
                      access,
                    ),
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" />
                {text("Download copy", "Baixar cópia")}
              </Button>
              <Button
                variant="outline"
                className="w-full border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                onClick={() => window.print()}
              >
                <Printer className="mr-2 h-4 w-4" />
                {text("Print / save as PDF", "Imprimir / salvar PDF")}
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                {text(
                  "The downloaded HTML copy opens offline. To save a PDF, choose “Save as PDF” in the print dialog.",
                  "A cópia HTML abre sem internet. Para salvar um PDF, escolha “Salvar como PDF” na janela de impressão.",
                )}
              </p>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
