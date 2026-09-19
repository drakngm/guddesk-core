import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { generateAgentSnapshots } from "@/lib/agent-analytics";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const workspaces = await prisma.workspace.findMany({
      select: { id: true },
    });

    let processed = 0;
    for (const ws of workspaces) {
      try {
        await generateAgentSnapshots(ws.id, yesterday);
        processed++;
      } catch (error) {
        console.error(`Agent snapshot error for workspace ${ws.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      workspacesProcessed: processed,
    });
  } catch (error) {
    console.error("Agent performance cron error:", error);
    return NextResponse.json(
      { error: "Failed to generate snapshots" },
      { status: 500 },
    );
  }
}
