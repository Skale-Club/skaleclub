/**
 * What the server keeps out of Sentry. Lives apart from instrument.ts because that file calls
 * Sentry.init on import, which a test cannot do.
 */

/**
 * Node prints deprecation warnings through console.error, and captureConsoleIntegration turns
 * every one into an issue at each boot. They are not failures, and they point at dependencies
 * more often than at this code.
 */
export const SENTRY_IGNORE_ERRORS = [/\(node:\d+\) \[DEP\d+\] DeprecationWarning/];

/**
 * Drizzle appends the bound values to its error text ("Failed query: ...\nparams: a,b"), so a
 * failed query sends whatever it was bound to: a token hash on /mcp, a visitor id on
 * attribution. The SQL stays, since it is what makes the event useful, and any stack trace
 * following the values stays too.
 */
const QUERY_PARAMS = /\nparams: [\s\S]*?(?=\n\s+at |$)/g;

function scrubValue<T>(value: T): T {
  if (typeof value === "string") {
    return (value.includes("Failed query:") ? value.replace(QUERY_PARAMS, "") : value) as T;
  }
  if (Array.isArray(value)) return value.map(scrubValue) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, scrubValue(entry)]),
    ) as T;
  }
  return value;
}

/** The subset of a Sentry event that can carry console or error text. */
interface ScrubbableEvent {
  message?: string;
  logentry?: unknown;
  exception?: { values?: Array<{ value?: string }> };
  extra?: unknown;
  breadcrumbs?: unknown;
}

export function scrubQueryParams<T extends ScrubbableEvent>(event: T): T {
  if (event.message !== undefined) event.message = scrubValue(event.message);
  if (event.logentry !== undefined) event.logentry = scrubValue(event.logentry);
  if (event.extra !== undefined) event.extra = scrubValue(event.extra);
  if (event.breadcrumbs !== undefined) event.breadcrumbs = scrubValue(event.breadcrumbs);
  for (const exception of event.exception?.values ?? []) {
    if (exception.value !== undefined) exception.value = scrubValue(exception.value);
  }
  return event;
}
