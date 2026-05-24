import { Pool } from "pg";
import type { QueryResult, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL;

let pool: Pool | undefined;

export function getPool() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined.");
  }

  if (!pool) {
    pool =
      global.pgPool ??
      new Pool({
        connectionString,
      });

    if (process.env.NODE_ENV !== "production") {
      global.pgPool = pool;
    }
  }

  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const result = await getPool().query<T>(text, params);
  return result;
}
