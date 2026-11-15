import { incrementRateLimitCounter } from "./cache";

export interface RateLimitResult {
  limited: boolean;
}

// Fixed-window limiter for login/MFA/password-reset attempts -- keyed by
// whatever the caller submitted (username or email), not by IP, since this
// app sits behind shared office/VPN egress IPs where per-IP limiting would
// either do nothing (NAT) or lock out everyone behind it at once. Fails
// open: a Redis outage must never turn into a login outage.
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const count = await incrementRateLimitCounter(key, windowSeconds);
  if (count === 0) return { limited: false };
  return { limited: count > limit };
}
