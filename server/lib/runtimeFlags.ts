/**
 * Opt-in switches for background work that touches the database on its own.
 *
 * Both default to OFF so `npm run dev` (which usually points at the production
 * database) never starts crons or self-applying maintenance by accident.
 * Production sets the ENABLE_* variables in Coolify. The legacy DISABLE_*=true
 * variables still win, so an old deployment config keeps its off switch.
 */
function enabled(enableVar: string, disableVar: string): boolean {
  if (process.env[disableVar] === "true") return false;
  return process.env[enableVar] === "true";
}

export function inprocessCronEnabled(): boolean {
  return enabled("ENABLE_INPROCESS_CRON", "DISABLE_INPROCESS_CRON");
}

export function bootstrapTasksEnabled(): boolean {
  return enabled("ENABLE_BOOTSTRAP_TASKS", "DISABLE_BOOTSTRAP_TASKS");
}
