export const LEAD_FORM_OPEN_EVENT = "lead-form:open";

/**
 * Ask the current page to open its own lead form. Pages own the modal and form
 * slug; callers only identify where the request came from. The click fallback
 * keeps older managed landings working while they migrate to the event.
 */
export function requestLeadFormOpen(source: string): boolean {
  const event = new CustomEvent(LEAD_FORM_OPEN_EVENT, {
    cancelable: true,
    detail: { source },
  });
  const handled = !document.dispatchEvent(event);
  if (handled) return true;

  const trigger = document.querySelector<HTMLElement>("[data-landing-lead-cta]");
  trigger?.click();
  return !!trigger;
}
