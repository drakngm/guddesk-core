"use client";

import { Icons } from "@/components/shared/icons";
import { timeAgo } from "@/lib/utils";

type CustomerEvent = {
  id: string;
  type: string;
  title: string;
  metadata: unknown;
  createdAt: Date;
};

interface CustomerTimelineProps {
  events: CustomerEvent[];
}

const eventIcons: Record<string, keyof typeof Icons> = {
  "customer.identified": "user",
  "customer.updated": "settings",
  "company.assigned": "building",
  "company.removed": "building",
  "conversation.created": "messageCircle",
  "conversation.closed": "check",
  "conversation.reopened": "inbox",
  "message.sent": "send",
  "message.received": "mail",
};

const eventColors: Record<string, string> = {
  "customer.identified": "bg-blue-500",
  "customer.updated": "bg-gray-500",
  "company.assigned": "bg-purple-500",
  "company.removed": "bg-orange-500",
  "conversation.created": "bg-green-500",
  "conversation.closed": "bg-gray-400",
  "conversation.reopened": "bg-green-400",
  "message.sent": "bg-blue-400",
  "message.received": "bg-indigo-500",
};

export function CustomerTimeline({ events }: CustomerTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        No activity yet. Events will appear here as this customer interacts
        with your product.
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="divide-y">
        {events.map((event) => {
          const iconName = eventIcons[event.type] || "sparkles";
          const IconComponent = Icons[iconName];
          const dotColor = eventColors[event.type] || "bg-gray-500";

          return (
            <div key={event.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 flex shrink-0 items-center justify-center">
                <div
                  className={`flex size-6 items-center justify-center rounded-full ${dotColor}`}
                >
                  <IconComponent className="size-3 text-white" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{event.title}</p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(event.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
