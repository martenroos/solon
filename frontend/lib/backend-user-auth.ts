import { createHmac } from "node:crypto";

type BackendUserAuthClaims = {
  sub: string;
  provider?: string | null;
  exp: number;
  iat: number;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

export function createBackendUserAuthToken(params: {
  email: string;
  provider?: string | null;
  secret: string;
  ttlSeconds?: number;
}) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const claims: BackendUserAuthClaims = {
    sub: params.email,
    provider: params.provider ?? null,
    iat: issuedAt,
    exp: issuedAt + (params.ttlSeconds ?? 300),
  };
  const payloadSegment = encodeBase64Url(JSON.stringify(claims));
  const signature = createHmac("sha256", params.secret).update(payloadSegment).digest("base64url");
  return `v1.${payloadSegment}.${signature}`;
}
