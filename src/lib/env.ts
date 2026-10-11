// Server-only access to secrets. Missing values give a readable error that never reveals a value.
export class ConfigError extends Error {}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new ConfigError(`${name} is not configured. Add it to .env.local (or Vercel env vars).`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}
