import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { triggerCsatSurvey } from "@/lib/surveys/trigger";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const configs = await prisma.surveyConfig.findMany({
      where: {
        type: "CSAT",
        isEnabled: true,
        trigger: "AFTER_DELAY",
      },
      select: {
        workspaceId: true,
        delayMinutes: true,
      },
    });

    let triggered = 0;

    for (const config of configs) {
      const delayAgo = new Date(Date.now() - config.delayMinutes * 60 * 1000);
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const conversations = await prisma.conversation.findMany({
        where: {
          workspaceId: config.workspaceId,
          status: "CLOSED",
          closedAt: {
            gte: twoHoursAgo,
            lte: delayAgo,
          },
          messages: {
            none: {
              type: "SYSTEM",
              body: { contains: '"type":"csat_survey"' },
            },
          },
        },
        select: { id: true },
        take: 50,
      });

      for (const conv of conversations) {
        try {
          const sent = await triggerCsatSurvey(conv.id);
          if (sent) triggered++;
        } catch (error) {
          console.error(`Survey trigger error for ${conv.id}:`, error);
        }
      }
    }

    return NextResponse.json({ success: true, triggered });
  } catch (error) {
    console.error("Survey cron error:", error);
    return NextResponse.json(
      { error: "Survey cron failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
