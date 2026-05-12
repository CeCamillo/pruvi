import { Worker, type Job } from "bullmq";
import { env } from "@pruvi/env/server";
import { db } from "@pruvi/db";
import { parseRedisUrl } from "../utils/redis";
import { BillingRepository } from "../features/billing/billing.repository";
import { BillingService } from "../features/billing/billing.service";
import { UltraService } from "../features/ultra/ultra.service";
import { UltraRepository } from "../features/ultra/ultra.repository";

type BillingSweepJobData = { kind: "sweep" };

export function startBillingSweepWorker() {
  if (!env.REDIS_URL) {
    console.log("No REDIS_URL — billing sweep worker disabled");
    return null;
  }

  const connection = parseRedisUrl(env.REDIS_URL);
  const repo = new BillingRepository();
  const ultra = new UltraService(new UltraRepository(db));   // canonical construction per billing.route.ts:16
  const service = new BillingService(db, repo, ultra);

  const worker = new Worker<BillingSweepJobData>(
    "billing-cron",
    async (_job: Job<BillingSweepJobData>) => {
      const result = await service.runReconciliationSweep({ now: new Date() });
      return result;
    },
    { connection, concurrency: 1 },
  );

  worker.on("failed", (job, err) => console.error("billing-sweep job failed:", job?.id, err));
  worker.on("completed", (_job, result) => console.log("billing-sweep done:", result));

  const cleanup = async () => {
    await worker.close();
  };

  return { cleanup };
}
