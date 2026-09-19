/**
 * Channel provider registry.
 */

import type { ConversationChannel } from "@prisma/client";
import type { ChannelProvider } from "./types";
import { WidgetChannelProvider } from "./widget/provider";
import { EmailChannelProvider } from "./email/provider";

const providers = new Map<ConversationChannel, ChannelProvider>();

// Register built-in providers
providers.set("WIDGET", new WidgetChannelProvider());
providers.set("EMAIL", new EmailChannelProvider());

/**
 * Get the channel provider for a given channel type.
 * Returns null for API channel (no external channel to communicate with).
 */
export function getChannelProvider(
  channel: ConversationChannel,
): ChannelProvider | null {
  return providers.get(channel) ?? null;
}
