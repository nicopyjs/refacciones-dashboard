export const SESSION_COOKIE = "obs_session";

export function isValidSessionValue(value: string | undefined | null): boolean {
  const secret = process.env.AUTH_SECRET;
  if (!secret || !value) return false;
  return value === secret;
}
