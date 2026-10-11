import { neon } from "@neondatabase/serverless";
import { requireEnv } from "./env";

let client: ReturnType<typeof neon> | null = null;

/** Run one parameterised query. Always pass user input through `params`, never concatenate it. */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  client ??= neon(requireEnv("DATABASE_URL"));
  return (await client.query(text, params)) as T[];
}
