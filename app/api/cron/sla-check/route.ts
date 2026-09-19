import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { checkSlaBreaches, markAsBreached } from "@/lib/sla/check";
import { sendSlaBreachNotification } from "@/lib/email-notifications";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const breaches = await checkSlaBreaches();

    let processed = 0;
    for (const breach of breaches) {
      try {
        const breachLabel =
          breach.breachType === "first_response"
            ? "First response SLA breached"
            : "Resolution SLA breached";

        await prisma.message.create({
          data: {
            conversationId: breach.conversationId,
            type: "SYSTEM",
            body: `${breachLabel} — deadline was ${breach.dueAt.toISOString()}`,
          },
        });

        await sendSlaBreachNotification(
          breach.conversationId,
          breach.breachType,
        );

        await markAsBreached(breach.conversationId);

        processed++;
      } catch (error) {
        console.error(
          `SLA breach processing error for ${breach.conversationId}:`,
          error,
        );
      }
    }

    return NextResponse.json({
      success: true,
      breachesFound: breaches.length,
      processed,
    });
  } catch (error) {
    console.error("SLA check cron error:", error);
    return NextResponse.json(
      { error: "SLA check failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
