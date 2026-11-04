import { z } from "zod";

export const contractDraftSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    body: z.string().trim().min(20).max(100_000),
    companyName: z.string().trim().min(2).max(200),
    companyEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    signerName: z.string().trim().min(2).max(200),
    signerEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    language: z.enum(["en", "pt"]).default("en"),
    expiresInDays: z.number().int().min(1).max(90).default(30),
  })
  .strict();

export type ContractDraft = z.infer<typeof contractDraftSchema>;
export const signingConsent = {
  en: "I have read this contract and agree to its terms. I consent to electronic records and signatures for this transaction, and adopt my typed name as my electronic signature. I can download, save and print this document. Before signing, I may contact the company at the email shown to request a paper copy at no charge, update my contact details, or withdraw my consent and arrange an alternative signing method. Withdrawing consent does not undo a document already signed. I need an email account and a browser capable of displaying, saving and printing this page.",
  pt: "Li este contrato e concordo com seus termos. Aceito registros e assinaturas eletrônicas para esta transação e adoto meu nome digitado como minha assinatura eletrônica. Posso baixar, salvar e imprimir este documento. Antes de assinar, posso contatar a empresa pelo e-mail indicado para solicitar uma cópia em papel sem custo, atualizar meus dados ou retirar meu consentimento e combinar outra forma de assinatura. A retirada do consentimento não desfaz um documento já assinado. Preciso de uma conta de e-mail e de um navegador capaz de exibir, salvar e imprimir esta página.",
} as const;

export interface ContractSnapshot {
  schemaVersion: 1;
  id: string;
  title: string;
  body: string;
  companyName: string;
  companyEmail: string;
  signerName: string;
  signerEmail: string;
  language: "en" | "pt";
  sentAt: string;
  expiresAt: string;
  consent: string;
}

export interface ContractReceipt {
  schemaVersion: 1;
  document: ContractSnapshot;
  documentHash: string;
  signature: {
    typedName: string;
    email: string;
    emailVerifiedAt: string;
    signedAt: string;
    ipAddress: string;
    userAgent: string;
    consent: string;
    method: "email_otp_typed_name";
  };
  seal: string;
}

export interface ContractEvent {
  id: string;
  contractId: string;
  type: string;
  occurredAt: string;
  actor: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ContractView extends ContractDraft {
  id: string;
  status: "draft" | "sent" | "signed" | "voided";
  version: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  documentHash: string | null;
  snapshot: ContractSnapshot | null;
  receipt: ContractReceipt | null;
  sharePath?: string;
}

export interface SigningGate {
  companyName: string;
  maskedEmail: string;
  language: "en" | "pt";
  status: ContractView["status"] | "expired";
}
