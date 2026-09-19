import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const workspaceId = session.metadata?.workspaceId;
        if (workspaceId && session.subscription) {
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              plan: "PRO",
              stripeSubscriptionId: session.subscription as string,
              stripeCustomerId: session.customer as string,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const workspace = await prisma.workspace.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (workspace) {
          const isActive = ["active", "trialing"].includes(
            subscription.status,
          );
          await prisma.workspace.update({
            where: { id: workspace.id },
            data: { plan: isActive ? "PRO" : "FREE" },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const workspace = await prisma.workspace.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (workspace) {
          await prisma.workspace.update({
            where: { id: workspace.id },
            data: {
              plan: "FREE",
              stripeSubscriptionId: null,
            },
          });
        }
        break;
      }
    }
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
