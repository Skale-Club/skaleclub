import pg from "pg";

// `timestamp without time zone` (OID 1114) carries no offset. node-postgres
// would parse it in the process's local zone; every writer in this app stores
// UTC, so read it back as UTC regardless of where the server runs.
// Import this module before the first query (server/index.ts does).
pg.types.setTypeParser(1114, (value: string) => new Date(`${value.replace(" ", "T")}Z`));
