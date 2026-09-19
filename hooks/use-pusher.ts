"use client";

import { useEffect, useRef } from "react";
import type { Channel } from "pusher-js";

import { acquireChannel, getPusherClient, releaseChannel } from "@/lib/pusher-client";

export function usePusher(
  channelName: string | null,
  eventName: string,
  callback: (data: any) => void,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!channelName) return;

    const client = getPusherClient();
    if (!client) return;

    const channel: Channel = acquireChannel(client, channelName);

    const handler = (data: any) => {
      callbackRef.current(data);
    };

    channel.bind(eventName, handler);

    return () => {
      channel.unbind(eventName, handler);
      releaseChannel(client, channelName);
    };
  }, [channelName, eventName]);
}

/**
 * Run a callback whenever the Pusher connection recovers after a drop.
 * Used to refetch data so we don't miss events that fired while
 * disconnected. The callback is also invoked once the very first time
 * the connection becomes "connected" so initial subscribers don't have
 * to special-case it.
 */
export function usePusherReconnect(callback: () => void) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const client = getPusherClient();
    if (!client) return;

    let sawDisconnect = false;

    const handler = (states: { previous: string; current: string }) => {
      if (states.current === "connected" && sawDisconnect) {
        callbackRef.current();
      }
      if (
        states.current === "disconnected" ||
        states.current === "unavailable" ||
        states.current === "failed"
      ) {
        sawDisconnect = true;
      }
    };

    client.connection.bind("state_change", handler);
    return () => {
      client.connection.unbind("state_change", handler);
    };
  }, []);
}
