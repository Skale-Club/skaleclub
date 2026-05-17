import type { Form } from '@shared/schema';

export type FormRow = Form & { _leadCount: number };

export type LeadRow = {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  createdAt: string | null;
  status: string | null;
  classificacao: string | null;
  source: string | null;
  urlOrigem: string | null;
  formCompleto: boolean;
};

export const PAGE_SIZE = 20;
