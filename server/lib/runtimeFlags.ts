/**
 * Switches for background work that touches the database on its own.
 *
 * - In-process crons are opt-in everywhere (ENABLE_INPROCESS_CRON=true), so a
 *   dev server on the production database never starts them.
 * - Bootstrap tasks default ON in production (they must self-apply after a
 *   deploy) and OFF in development unless ENABLE_BOOTSTRAP_TASKS=true.
 *
 * The legacy DISABLE_*=true variables always win.
 */
export function inprocessCronEnabled(): boolean {
  if (process.env.DISABLE_INPROCESS_CRON === "true") return false;
  return process.env.ENABLE_INPROCESS_CRON === "true";
}

export function bootstrapTasksEnabled(): boolean {
  if (process.env.DISABLE_BOOTSTRAP_TASKS === "true") return false;
  if (process.env.ENABLE_BOOTSTRAP_TASKS === "true") return true;
  return process.env.NODE_ENV === "production";
}
