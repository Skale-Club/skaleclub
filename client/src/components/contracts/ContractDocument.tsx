import type { ContractView } from "@shared/contracts";

export function ContractDocument({ contract }: { contract: ContractView }) {
  const d = contract.receipt?.document ?? contract.snapshot ?? contract;
  const pt = d.language === "pt";
  const signature = contract.receipt?.signature;
  return (
    <article
      className="contract-document rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm sm:p-10"
      data-testid="contract-document"
      lang={d.language}
    >
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold text-blue-700">{d.companyName}</p>
        <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
          {d.title}
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          {d.signerName} · {d.signerEmail}
        </p>
        <a
          className="text-sm text-blue-700 underline"
          href={`mailto:${d.companyEmail}`}
        >
          {d.companyEmail}
        </a>
      </header>
      <div className="my-8 whitespace-pre-wrap break-words text-[15px] leading-7">
        {d.body}
      </div>
      {signature && (
        <section
          className="border-t border-slate-200 pt-6"
          data-testid="signed-record"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {pt ? "Assinado eletronicamente" : "Electronically signed"}
          </p>
          <p className="my-4 break-words font-serif text-3xl italic">
            {signature.typedName}
          </p>
          <p className="text-sm">{signature.email}</p>
          <p className="text-sm text-slate-600">
            {new Date(signature.signedAt).toLocaleString(
              pt ? "pt-BR" : "en-US",
            )}{" "}
            · {signature.ipAddress}
          </p>
          <p className="mt-4 text-xs leading-5 text-slate-600">
            {signature.consent}
          </p>
          <p className="mt-3 text-xs text-slate-600">
            {pt
              ? "Este registro contém a assinatura do destinatário; não registra uma contra-assinatura da empresa."
              : "This record contains the recipient’s signature; a company countersignature is not recorded."}
          </p>
        </section>
      )}
      {contract.documentHash && (
        <footer className="mt-8 border-t border-slate-200 pt-4 text-[10px] text-slate-500">
          <p>
            {pt ? "Identificação do documento" : "Document ID"}: {contract.id}
          </p>
          <p className="mt-1 break-all">SHA-256: {contract.documentHash}</p>
          {contract.receipt && (
            <p className="mt-1 break-all">
              {pt ? "Selo do registro" : "Record seal"}: {contract.receipt.seal}
            </p>
          )}
        </footer>
      )}
    </article>
  );
}
