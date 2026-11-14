/**
 * Longest the initial shell may keep the app hidden or covered, in ms.
 *
 * Until a route component mounts, App renders `invisible` behind index.html's loader (or
 * the server's text fallback). Anything that gates the first paint needs a ceiling like
 * this one: the homepage's API chain does not settle for several seconds, which is past a
 * crawler's render budget, and a page that stays hidden is scored as empty.
 */
export const INITIAL_SHELL_TIMEOUT_MS = 2500;
