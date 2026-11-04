import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";
import { sendEmail } from "./send";

export interface Signup {
  userId: string;
  email: string;
}

export class SignupFlow extends WorkflowEntrypoint<Env, Signup> {
  async run(event: WorkflowEvent<Signup>, step: WorkflowStep) {
    const { userId, email } = event.payload;

    await step.do("send welcome", async () => {
      await sendEmail(this.env, email, "welcome");
    });

    await step.sleep("wait 3 days", "3 days");

    const active = await step.do("check activity", async () => {
      const row = await this.env.DB
        .prepare("SELECT COUNT(*) AS n FROM notes WHERE user_id = ?")
        .bind(userId)
        .first<{ n: number }>();
      return (row?.n ?? 0) > 0;
    });

    if (!active) {
      await step.do(
        "send reminder",
        { retries: { limit: 5, delay: "1 minute", backoff: "exponential" } },
        async () => sendEmail(this.env, email, "reminder"),
      );
    }
  }
}
