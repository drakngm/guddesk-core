"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertEmailChannelConfig } from "@/actions/manage-email-channel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/shared/icons";

interface EmailChannelConfig {
  id: string;
  isEnabled: boolean;
  supportAddress: string | null;
  fromName: string | null;
  fromAddress: string | null;
  signature: string | null;
  autoReopen: boolean;
}

interface Props {
  config: EmailChannelConfig | null;
  workspaceId: string;
  supportAddress: string;
}

export function EmailChannelSettings({ config, workspaceId, supportAddress }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? false);
  const [fromName, setFromName] = useState(config?.fromName ?? "");
  const [fromAddress, setFromAddress] = useState(config?.fromAddress ?? "");
  const [signature, setSignature] = useState(config?.signature ?? "");
  const [autoReopen, setAutoReopen] = useState(config?.autoReopen ?? true);

  function handleSave() {
    startTransition(async () => {
      const result = await upsertEmailChannelConfig(workspaceId, {
        isEnabled,
        fromName: fromName.trim() || undefined,
        fromAddress: fromAddress.trim() || undefined,
        signature: signature.trim() || undefined,
        autoReopen,
      });

      if (result.status === "success") {
        toast.success("Email channel settings saved");
      } else {
        toast.error(result.message ?? "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Enable / Disable */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Email Channel</CardTitle>
              <CardDescription>
                Accept support requests via email. Customers can email your support address
                and conversations will appear in your inbox.
              </CardDescription>
            </div>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>
        </CardHeader>
      </Card>

      {/* Support Address (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support Address</CardTitle>
          <CardDescription>
            Share this email address with customers or set up email forwarding from your
            custom domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-mono">
              {supportAddress}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(supportAddress);
                toast.success("Copied to clipboard");
              }}
            >
              <Icons.copy className="mr-1.5 size-3.5" />
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Emails sent to this address will create new conversations in your inbox.
            Replies to outbound emails will be threaded into the existing conversation.
          </p>
        </CardContent>
      </Card>

      {/* Sender Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outbound Settings</CardTitle>
          <CardDescription>
            Configure how outbound emails appear when agents reply to email conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromName">From Name</Label>
              <Input
                id="fromName"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="e.g. Acme Support"
              />
              <p className="text-xs text-muted-foreground">
                Display name for outbound emails
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromAddress">From Address</Label>
              <Input
                id="fromAddress"
                type="email"
                value={fromAddress}
                onChange={(e) => setFromAddress(e.target.value)}
                placeholder="e.g. support@acme.com"
              />
              <p className="text-xs text-muted-foreground">
                Must be a verified sender address
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signature">Email Signature</Label>
            <Textarea
              id="signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="HTML signature appended to outbound emails..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              HTML is supported. Leave blank for no signature.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behavior</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-reopen on reply</Label>
              <p className="text-xs text-muted-foreground">
                Automatically reopen closed conversations when a customer sends a new email reply.
              </p>
            </div>
            <Switch checked={autoReopen} onCheckedChange={setAutoReopen} />
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Icons.spinner className="mr-2 size-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
