import { AwsClient } from "aws4fetch";

export async function uploadUrl(env: Env, key: string) {
  const r2 = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });
  const url = new URL(
    `https://${env.ACCOUNT_ID}.r2.cloudflarestorage.com` +
      `/notes-attachments/${key}`,
  );
  url.searchParams.set("X-Amz-Expires", "600"); // 10 minutes
  const signed = await r2.sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}
