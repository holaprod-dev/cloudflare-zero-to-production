interface TurnstileResponse {
  success: boolean;
  "error-codes": string[];
}

export async function isHuman(
  env: Env,
  token: string | null,
  ip: string | undefined,
) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  const r = await res.json<TurnstileResponse>();
  return r.success;
}
