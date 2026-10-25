import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

let cached: { address: string; jwks: ReturnType<typeof createRemoteJWKSet> } | undefined;

/** JWTs must come from the configured trusted issuer; never accept tenant_id from JSON. */
export async function verifyBookingIdentity(authorization: string | null) {
  const jwksUrl = process.env.BOOKING_AUTH_JWKS_URL;
  const issuer = process.env.BOOKING_AUTH_ISSUER;
  const audience = process.env.BOOKING_AUTH_AUDIENCE;
  if (!jwksUrl || !issuer || !audience) {
    throw new Error("BOOKING_AUTH_NOT_CONFIGURED");
  }
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(authorization ?? "");
  if (!match) return null;
  if (!cached || cached.address !== jwksUrl) {
    const url = new URL(jwksUrl);
    if (url.protocol !== "https:") throw new Error("BOOKING_AUTH_JWKS_URL must be https");
    cached = { address: jwksUrl, jwks: createRemoteJWKSet(url) };
  }
  try {
    const { payload } = await jwtVerify(match[1], cached.jwks, {
      issuer, audience, algorithms: ["RS256", "ES256"],
      clockTolerance: "5s",
    });
    const tenantId = payload.tenant_id;
    const externalAuthId = payload.sub;
    if (
      typeof tenantId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId) ||
      typeof externalAuthId !== "string" || !externalAuthId || externalAuthId.length > 256
    ) return null;
    return { tenantId, externalAuthId };
  } catch { return null; }
}
