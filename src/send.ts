type Template = "welcome" | "reminder";

const TEMPLATES: Record<Template, { subject: string; text: string }> = {
  welcome: {
    subject: "Welcome to Notes",
    text: "Thanks for signing up. Your first note is waiting for you.",
  },
  reminder: {
    subject: "Shall we write the first note?",
    text: "Your notebook is still empty. A title is all you need to start.",
  },
};

export async function sendEmail(
  env: Env,
  to: string,
  template: Template,
) {
  const { subject, text } = TEMPLATES[template];
  const response = await env.EMAIL.send({
    from: { name: "Notes", email: "hello@mydomain.dev" },
    to,
    subject,
    text,
    html: `<p>${text}</p>`,
  });
  return response.messageId;
}
