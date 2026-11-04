import { createRemoteJWKSet, jwtVerify } from "jose";

export async function getAccessUser(req: Request, env: Env) {
  const token = req.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  const team = `https://${env.ACCESS_TEAM}.cloudflareaccess.com`;
  const keys = createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: team,
      audience: env.ACCESS_AUD,
    });
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}
