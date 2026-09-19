"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/shared/icons";

interface BillingPanelProps {
  workspaceId: string;
  plan: string;
  currentSeats: number;
  maxSeats: number;
  currentConversations: number;
  maxConversations: number;
  currentWorkspaces?: number;
  maxWorkspaces?: number;
  aiEnabled: boolean;
  hasStripe: boolean;
}

export function BillingPanel({
  workspaceId,
  plan,
  currentSeats,
  maxSeats,
  currentConversations,
  maxConversations,
  currentWorkspaces,
  maxWorkspaces,
  aiEnabled,
  hasStripe,
}: BillingPanelProps) {
  const [loading, setLoading] = useState(false);
  const isPro = plan === "PRO";

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  async function handleManage() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Current plan */}
      <div className="rounded-lg border p-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Current Plan</h3>
          <Badge variant={isPro ? "default" : "secondary"}>
            {isPro ? "Pro" : "Free"}
          </Badge>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">Members</p>
            <p className="mt-1 text-2xl font-bold">
              {currentSeats}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {maxSeats === Infinity ? "unlimited" : maxSeats}
              </span>
            </p>
          </div>

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              Conversations (this month)
            </p>
            <p className="mt-1 text-2xl font-bold">
              {currentConversations}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {maxConversations === Infinity ? "unlimited" : maxConversations}
              </span>
            </p>
          </div>

          {currentWorkspaces !== undefined && maxWorkspaces !== undefined && (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">Workspaces</p>
              <p className="mt-1 text-2xl font-bold">
                {currentWorkspaces}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}/ {maxWorkspaces === Infinity ? "unlimited" : maxWorkspaces}
                </span>
              </p>
            </div>
          )}

          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">AI Features</p>
            <p className="mt-1 text-2xl font-bold">
              {aiEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Free */}
        <div className="rounded-lg border p-6">
          <h4 className="font-semibold">Free</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            For small teams getting started
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>1 workspace</li>
            <li>Up to 2 members</li>
            <li>500 conversations/month</li>
            <li>Knowledge base</li>
            <li>GudDesk branding required</li>
          </ul>
          {!isPro && (
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Current plan
            </p>
          )}
        </div>

        {/* Pro */}
        <div className="rounded-lg border-2 border-primary p-6">
          <h4 className="font-semibold">Pro</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            For growing teams that need more
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>Unlimited workspaces</li>
            <li>Unlimited members</li>
            <li>Unlimited conversations</li>
            <li>AI-powered features</li>
            <li>Remove GudDesk branding</li>
            <li>Priority support</li>
          </ul>
          <div className="mt-4">
            {isPro ? (
              <Button
                variant="outline"
                onClick={handleManage}
                disabled={loading}
                className="w-full"
              >
                {loading && <Icons.spinner className="mr-2 size-4 animate-spin" />}
                Manage Subscription
              </Button>
            ) : (
              <Button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full"
              >
                {loading && <Icons.spinner className="mr-2 size-4 animate-spin" />}
                Upgrade to Pro
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Manage billing */}
      {isPro && hasStripe && (
        <div className="rounded-lg border p-6">
          <h4 className="font-semibold">Billing Management</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Update payment methods, view invoices, or cancel your subscription.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={handleManage}
            disabled={loading}
          >
            Open Billing Portal
          </Button>
        </div>
      )}
    </div>
  );
}
