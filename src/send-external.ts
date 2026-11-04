export async function sendWithResend(env: Env, to: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Notes <hello@mydomain.dev>",
      to: [to],
      subject: "Welcome to Notes",
      text: "Thanks for signing up.",
    }),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}`);
}
