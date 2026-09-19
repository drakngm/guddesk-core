/**
 * Widget channel provider.
 *
 * Thin wrapper — the widget uses Pusher for real-time delivery,
 * so sendOutbound is a no-op. handleInbound is also not used
 * because widget conversations are created via the widget API.
 */

import type { ConversationChannel, Message } from "@prisma/client";
import type { ChannelProvider, InboundPayload, InboundResult, OutboundContext } from "../types";

export class WidgetChannelProvider implements ChannelProvider {
  channel: ConversationChannel = "WIDGET";

  async handleInbound(_payload: InboundPayload): Promise<InboundResult> {
    throw new Error("Widget conversations are created via /api/widget/conversations, not through the channel provider");
  }

  async sendOutbound(_context: OutboundContext, _message: Message): Promise<void> {
    // No-op: widget uses Pusher for real-time message delivery
  }
}
