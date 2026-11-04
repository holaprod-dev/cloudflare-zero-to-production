import { extractText } from "./text"; // your logic: read the PDF, the image…

export interface AttachmentTask {
  key: string;
  noteId: number;
}

export async function processBatch(
  batch: MessageBatch<AttachmentTask>,
  env: Env,
) {
  for (const message of batch.messages) {
    try {
      await extractText(env, message.body);
      message.ack();
    } catch (err) {
      console.error("Failed to process", message.body.key, err);
      message.retry({ delaySeconds: 60 });
    }
  }
}
