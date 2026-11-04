import PostalMime from "postal-mime";

const ALLOWED = new Set(["you@gmail.com"]);

export async function incomingEmail(
  message: ForwardableEmailMessage,
  env: Env,
) {
  if (!ALLOWED.has(message.from)) {
    message.setReject("Sender not allowed");
    return;
  }

  const email = await PostalMime.parse(message.raw);
  await env.DB
    .prepare(
      "INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)",
    )
    .bind("u_1", email.subject ?? "No subject", email.text ?? "")
    .run();

  // Also send me a copy.
  await message.forward("you@gmail.com");
}
