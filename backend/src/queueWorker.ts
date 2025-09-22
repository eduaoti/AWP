import { processEmailQueueOnce } from "./services/emailQueue";

const EVERY = Number(process.env.EMAIL_QUEUE_INTERVAL_SECONDS || 60) * 1000;

export function startEmailQueueWorker() {
  setInterval(() => {
    processEmailQueueOnce().catch(e => console.error("[QUEUE] error:", e));
  }, EVERY);
}
