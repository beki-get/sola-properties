
import { SignJWT, jwtVerify } from "jose";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

const secret = process.env.JWT_ACCESS_SECRET;

if (!secret || secret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET must be at least 32 characters long");
}

const secretKey = new TextEncoder().encode(secret);

export interface AccessTokenPayload {
  userId: string;
  role: "buyer" | "agent" | "developer" | "admin" | "finance_admin";
}

export async function signAccessToken(
  payload: AccessTokenPayload,
): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .setIssuer("sola-properties-api")
    .setAudience("sola-properties-web")
    .sign(secretKey);
}

export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ["HS256"],
    issuer: "sola-properties-api",
    audience: "sola-properties-web",
  });

  if (
    typeof payload.sub !== "string" ||
    typeof payload.role !== "string" ||
    !["buyer", "agent", "developer", "admin", "finance_admin"].includes(
      payload.role,
    )
  ) {
    throw new Error("Invalid access token claims");
  }

  return {
    userId: payload.sub,
    role: payload.role as AccessTokenPayload["role"],
  };
}
