const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

export async function summarize(env: Env, text: string) {
  const response = await env.AI.run(
    MODEL,
    {
      messages: [
        {
          role: "system",
          content: "Summarize in two sentences, in the text's language. No fluff.",
        },
        { role: "user", content: text.slice(0, 8000) },
      ],
      max_tokens: 200,
    },
    { gateway: { id: "notes" } },
  );
  return response.response;
}
