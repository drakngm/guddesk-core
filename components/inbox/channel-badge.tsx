"use client";

import { cn } from "@/lib/utils";
import { Icons } from "@/components/shared/icons";

type Channel = "WIDGET" | "EMAIL" | "API";

interface ChannelBadgeProps {
  channel: Channel;
  className?: string;
}

const channelConfig: Record<Channel, { icon: keyof typeof Icons; label: string }> = {
  WIDGET: { icon: "messageCircle", label: "Chat" },
  EMAIL: { icon: "mail", label: "Email" },
  API: { icon: "code", label: "API" },
};

export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const config = channelConfig[channel] ?? channelConfig.WIDGET;
  const IconComponent = Icons[config.icon];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
      title={config.label}
    >
      <IconComponent className="size-3" />
      {config.label}
    </span>
  );
}
