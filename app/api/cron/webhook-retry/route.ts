import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { retryDelivery } from "@/lib/webhooks";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    const deliveries = await prisma.webhookDelivery.findMany({
      where: {
        status: "PENDING",
        nextRetryAt: { lte: now },
      },
      select: { id: true },
      take: 50,
      orderBy: { nextRetryAt: "asc" },
    });

    let retried = 0;
    for (const delivery of deliveries) {
      try {
        await retryDelivery(delivery.id);
        retried++;
      } catch (error) {
        console.error(`Webhook retry failed for delivery ${delivery.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      found: deliveries.length,
      retried,
    });
  } catch (error) {
    console.error("Webhook retry cron error:", error);
    return NextResponse.json({ error: "Retry cron failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
