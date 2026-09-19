import PusherClient, { type Channel } from "pusher-js";

let pusherClientInstance: PusherClient | null = null;

export function getPusherClient(): PusherClient | null {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    return null;
  }

  if (!pusherClientInstance) {
    pusherClientInstance = new PusherClient(key, {
      cluster,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
  }

  return pusherClientInstance;
}

// Ref-counted channel subscriptions. Multiple hooks frequently bind
// different events on the same channel (e.g. useConversations binds 4
// events on private-workspace-{id}). Without ref-counting, the first
// hook to unmount calls client.unsubscribe() and tears down the channel
// for everyone still bound.
const channelRefCounts = new Map<string, number>();

export function acquireChannel(
  client: PusherClient,
  channelName: string,
): Channel {
  const next = (channelRefCounts.get(channelName) ?? 0) + 1;
  channelRefCounts.set(channelName, next);
  return client.subscribe(channelName);
}

export function releaseChannel(
  client: PusherClient,
  channelName: string,
): void {
  const current = channelRefCounts.get(channelName) ?? 0;
  if (current <= 1) {
    channelRefCounts.delete(channelName);
    client.unsubscribe(channelName);
  } else {
    channelRefCounts.set(channelName, current - 1);
  }
}
