// Completion handling for priced order forms (config.pricing.model).
//
// Runs after the lead upsert, from runLeadPostProcessing. Three jobs:
//   1. Recompute the quote server-side and freeze it onto the lead. Whatever
//      price the browser displayed is ignored — this is the number of record.
//   2. Flag a repeat customer by phone. The lookup happens HERE and never on a
//      public route: an endpoint that confirmed "this phone is a customer"
//      would let anyone enumerate the customer list.
//   3. Fire the Telegram alert so someone can call the person straight away.
//
// The order form is a request, not a purchase — nothing is charged and nothing
// goes into production from this path.

import type { IStorage } from "../storage.js";
import type { FormConfig, FormLead } from "#shared/schema.js";
import { quoteFromAnswers, resolvePricingQuestionIds } from "#shared/form.js";
import { NFC_ON_REQUEST_LABEL, buildNfcQuoteSnapshot, formatUsdCents } from "#shared/nfc-pricing.js";
import { dispatchNotification } from "./notifications.js";

/** Flattens a lead back into the answer map the shared quote helper expects. */
function answersFromLead(lead: FormLead): Record<string, string | undefined> {
  return {
    ...(lead.customAnswers || {}),
    nome: lead.nome || undefined,
    email: lead.email || undefined,
    telefone: lead.telefone || undefined,
    cidadeEstado: lead.cidadeEstado || undefined,
    tipoNegocio: lead.tipoNegocio || undefined,
  };
}

export function isPricedForm(formConfig: FormConfig): boolean {
  return formConfig?.pricing?.model === "nfc-keychain";
}

/**
 * Price, stamp and announce a completed order. Best-effort throughout: a
 * failure here must never cost the lead, so the caller gets the freshest lead
 * it can and errors are logged rather than thrown.
 */
export async function finalizeNfcOrder(
  storage: IStorage,
  lead: FormLead,
  formConfig: FormConfig,
  companyName: string,
): Promise<FormLead> {
  if (!isPricedForm(formConfig) || !lead.formCompleto) return lead;

  const custom = lead.customAnswers || {};
  const alreadyHandled = Boolean(custom.nfcOrderNotifiedAt);

  const ids = resolvePricingQuestionIds(formConfig);
  const answers = answersFromLead(lead);

  // Two independent signals. They can disagree (someone says "no" on their
  // second order, or vice versa) — the alert shows both so the operator can
  // sort it out on the call.
  const declaredReturning = (answers[ids.returningQuestionId] ?? "") === ids.returningValue;
  let previousOrders = 0;
  try {
    if (lead.telefone) {
      previousOrders = await storage.countCompletedLeadsByPhone(lead.telefone, lead.id);
    }
  } catch (err) {
    console.error("[nfc-order] repeat-customer lookup failed:", err);
  }
  const isFirstOrder = !declaredReturning && previousOrders === 0;

  const quote = quoteFromAnswers(formConfig, { ...answers, [ids.returningQuestionId]: isFirstOrder ? "" : ids.returningValue });
  if (!quote) return lead;

  let current = lead;
  try {
    const updated = await storage.mergeFormLeadCustomAnswers(lead.id, {
      ...buildNfcQuoteSnapshot(quote),
      nfcPreviousOrders: String(previousOrders),
      nfcDeclaredReturning: declaredReturning ? "yes" : "no",
      nfcOrderNotifiedAt: custom.nfcOrderNotifiedAt || new Date().toISOString(),
    });
    if (updated) current = updated;
  } catch (err) {
    console.error("[nfc-order] could not store the quote snapshot:", err);
  }

  // A resubmitted final step must not ping the team twice.
  if (alreadyHandled) return current;

  try {
    await dispatchNotification(storage, "nfc_order", {
      company: companyName,
      name: current.nome?.trim() || "No name",
      phone: current.telefone?.trim() || "No phone",
      business: (custom.nomeEmpresa || current.tipoNegocio || "").trim(),
      quantity: String(quote.quantity),
      keychainType: quote.typeLabel,
      total: quote.quoteOnRequest ? NFC_ON_REQUEST_LABEL : formatUsdCents(quote.totalCents),
      artFee: quote.artFeeApplies ? formatUsdCents(quote.artFeeCents) : "waived",
      customerStatus: isFirstOrder
        ? "New customer"
        : `Returning (${previousOrders} previous order${previousOrders === 1 ? "" : "s"})`,
      logo: custom.logo__filename || custom.logo || "not sent",
      address: (custom.enderecoEnvio || "").trim(),
    });
  } catch (err) {
    console.error("[nfc-order] Telegram alert failed:", err);
  }

  return current;
}
