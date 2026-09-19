"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bot, ExternalLink, Globe, Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";

import { Icons } from "@/components/shared/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  installAgentAction,
  uninstallAgentAction,
  updateAgentAction,
} from "@/actions/manage-agents";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentWebhook {
  id: string;
  url: string;
  isEnabled: boolean;
  onMessageCreated: boolean;
  onConversationCreated: boolean;
  onConversationClosed: boolean;
  onConversationAssigned: boolean;
}

interface AgentItem {
  id: string;
  name: string;
  description: string | null;
  type: string;
  iconUrl: string | null;
  creatorName: string | null;
  creatorUrl: string | null;
  config: unknown;
  isEnabled: boolean;
  priority: number;
  installedAt: Date;
  webhookEndpoint: AgentWebhook | null;
}

interface AgentSettingsProps {
  workspaceId: string;
  agents: AgentItem[];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AgentSettings({
  workspaceId,
  agents: initialAgents,
}: AgentSettingsProps) {
  const [agents, setAgents] = useState(initialAgents);
  const [isPending, startTransition] = useTransition();
  const [installOpen, setInstallOpen] = useState(false);

  // One-time credentials after install
  const [credentials, setCredentials] = useState<{
    agentName: string;
    webhookSecret: string;
    apiKey: string;
  } | null>(null);

  // ------- Toggle agent enabled/disabled -------
  const handleToggleEnabled = (agentId: string, enabled: boolean) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, isEnabled: enabled } : a)),
    );

    startTransition(async () => {
      const result = await updateAgentAction(agentId, workspaceId, {
        isEnabled: enabled,
      });
      if (result.status === "error") {
        toast.error(result.message);
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agentId ? { ...a, isEnabled: !enabled } : a,
          ),
        );
      }
    });
  };

  // ------- Toggle event subscription -------
  const handleToggleEvent = (
    agentId: string,
    field: string,
    value: boolean,
  ) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === agentId && a.webhookEndpoint
          ? {
              ...a,
              webhookEndpoint: { ...a.webhookEndpoint, [field]: value },
            }
          : a,
      ),
    );

    startTransition(async () => {
      const result = await updateAgentAction(agentId, workspaceId, {
        events: { [field]: value },
      });
      if (result.status === "error") {
        toast.error(result.message);
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agentId && a.webhookEndpoint
              ? {
                  ...a,
                  webhookEndpoint: { ...a.webhookEndpoint, [field]: !value },
                }
              : a,
          ),
        );
      }
    });
  };

  // ------- Uninstall agent -------
  const handleUninstall = (agentId: string, agentName: string) => {
    if (!confirm(`Uninstall "${agentName}"? This will also remove its webhook and API key.`)) {
      return;
    }

    startTransition(async () => {
      const result = await uninstallAgentAction(agentId, workspaceId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(`"${agentName}" has been uninstalled`);
      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    });
  };

  // ------- Install agent (from dialog form) -------
  const handleInstall = (data: {
    name: string;
    description: string;
    webhookUrl: string;
    creatorName: string;
    events: {
      onMessageCreated: boolean;
      onConversationCreated: boolean;
      onConversationClosed: boolean;
      onConversationAssigned: boolean;
    };
  }) => {
    startTransition(async () => {
      const result = await installAgentAction(workspaceId, {
        name: data.name,
        description: data.description || null,
        webhookUrl: data.webhookUrl,
        creatorName: data.creatorName || null,
        events: data.events,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(`"${data.name}" has been installed`);
      setInstallOpen(false);

      // Show one-time credentials
      setCredentials({
        agentName: data.name,
        webhookSecret: result.webhookSecret!,
        apiKey: result.apiKeyRaw!,
      });

      // Add to local state
      setAgents((prev) => [
        {
          id: result.agent!.id,
          name: result.agent!.name,
          description: result.agent!.description,
          type: result.agent!.type,
          iconUrl: result.agent!.iconUrl,
          creatorName: result.agent!.creatorName,
          creatorUrl: result.agent!.creatorUrl,
          config: null,
          isEnabled: true,
          priority: result.agent!.priority,
          installedAt: new Date(),
          webhookEndpoint: {
            id: result.agent!.webhookEndpointId!,
            url: data.webhookUrl,
            isEnabled: true,
            ...data.events,
          },
        },
        ...prev,
      ]);
    });
  };

  return (
    <div className="space-y-6">
      {/* One-time credential disclosure */}
      {credentials && (
        <CredentialsBanner
          credentials={credentials}
          onDismiss={() => setCredentials(null)}
        />
      )}

      {/* Header + Install button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Agents are external services that receive webhook events and interact
            with your workspace via the API.
          </p>
        </div>
        <Dialog open={installOpen} onOpenChange={setInstallOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Install Agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Install Agent</DialogTitle>
              <DialogDescription>
                Connect an external service that will receive events and interact
                with conversations via the API.
              </DialogDescription>
            </DialogHeader>
            <InstallAgentForm
              onSubmit={handleInstall}
              isPending={isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Agent list */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Bot className="size-7 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No agents installed</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Install an agent to automate conversations. Agents receive events
              via webhooks and act via the API.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isPending={isPending}
              onToggleEnabled={(enabled) =>
                handleToggleEnabled(agent.id, enabled)
              }
              onToggleEvent={(field, value) =>
                handleToggleEvent(agent.id, field, value)
              }
              onUninstall={() => handleUninstall(agent.id, agent.name)}
            />
          ))}
        </div>
      )}

      {/* Help text */}
      <div className="rounded-lg border p-4">
        <h3 className="font-medium">How Agents Work</h3>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
            When events happen (new message, new conversation, etc.), GudDesk
            sends a webhook to your agent&apos;s URL.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
            Your agent processes the event and can reply, tag, assign, or
            resolve conversations using the API key provided at install.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
            Each agent brings its own logic and LLM — GudDesk just provides the
            data and actions.
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent Card
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  isPending,
  onToggleEnabled,
  onToggleEvent,
  onUninstall,
}: {
  agent: AgentItem;
  isPending: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onToggleEvent: (field: string, value: boolean) => void;
  onUninstall: () => void;
}) {
  const typeBadge = {
    BUILT_IN: { label: "Built-in", variant: "default" as const },
    MARKETPLACE: { label: "Marketplace", variant: "secondary" as const },
    CUSTOM: { label: "Custom", variant: "outline" as const },
  }[agent.type] ?? { label: agent.type, variant: "outline" as const };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white">
            {agent.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={agent.iconUrl}
                alt=""
                className="size-10 rounded-lg"
              />
            ) : (
              <Bot className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{agent.name}</h4>
              <Badge variant={typeBadge.variant} className="text-[10px]">
                {typeBadge.label}
              </Badge>
            </div>
            {agent.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {agent.description}
              </p>
            )}
            {agent.creatorName && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                by{" "}
                {agent.creatorUrl ? (
                  <a
                    href={agent.creatorUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"
                  >
                    {agent.creatorName}
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  agent.creatorName
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor={`agent-enabled-${agent.id}`} className="text-sm">
              Enabled
            </Label>
            <Switch
              id={`agent-enabled-${agent.id}`}
              checked={agent.isEnabled}
              onCheckedChange={onToggleEnabled}
            />
          </div>
        </div>
      </div>

      {/* Webhook info + event toggles */}
      {agent.webhookEndpoint && (
        <>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Webhook URL: </span>
            <span className="font-mono text-xs">
              {maskUrl(agent.webhookEndpoint.url)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EventToggle
              label="Message created"
              checked={agent.webhookEndpoint.onMessageCreated}
              onChange={(v) => onToggleEvent("onMessageCreated", v)}
            />
            <EventToggle
              label="Conversation created"
              checked={agent.webhookEndpoint.onConversationCreated}
              onChange={(v) => onToggleEvent("onConversationCreated", v)}
            />
            <EventToggle
              label="Conversation closed"
              checked={agent.webhookEndpoint.onConversationClosed}
              onChange={(v) => onToggleEvent("onConversationClosed", v)}
            />
            <EventToggle
              label="Conversation assigned"
              checked={agent.webhookEndpoint.onConversationAssigned}
              onChange={(v) => onToggleEvent("onConversationAssigned", v)}
            />
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onUninstall}
          disabled={isPending}
        >
          <Trash2 className="mr-1 size-3" />
          Uninstall
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Install Agent Form (inside Dialog)
// ---------------------------------------------------------------------------

function InstallAgentForm({
  onSubmit,
  isPending,
}: {
  onSubmit: (data: {
    name: string;
    description: string;
    webhookUrl: string;
    creatorName: string;
    events: {
      onMessageCreated: boolean;
      onConversationCreated: boolean;
      onConversationClosed: boolean;
      onConversationAssigned: boolean;
    };
  }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [onMessageCreated, setOnMessageCreated] = useState(true);
  const [onConversationCreated, setOnConversationCreated] = useState(true);
  const [onConversationClosed, setOnConversationClosed] = useState(false);
  const [onConversationAssigned, setOnConversationAssigned] = useState(false);

  const canSubmit = name.trim() && webhookUrl.trim();

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="agent-name">Name *</Label>
        <Input
          id="agent-name"
          placeholder="e.g. Support Bot, RefundBot"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="agent-webhook">Webhook URL *</Label>
        <Input
          id="agent-webhook"
          placeholder="https://your-agent.com/webhook"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Must use HTTPS. GudDesk will POST events to this URL.
        </p>
      </div>

      <div>
        <Label htmlFor="agent-desc">Description</Label>
        <Input
          id="agent-desc"
          placeholder="What does this agent do?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="agent-creator">Creator</Label>
        <Input
          id="agent-creator"
          placeholder="e.g. Your name or company"
          value={creatorName}
          onChange={(e) => setCreatorName(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label>Events to subscribe to</Label>
        <div className="mt-2 space-y-2">
          <EventCheckbox
            id="evt-message"
            label="Message created"
            description="When a visitor or agent sends a message"
            checked={onMessageCreated}
            onChange={setOnMessageCreated}
          />
          <EventCheckbox
            id="evt-conv-created"
            label="Conversation created"
            description="When a new conversation starts"
            checked={onConversationCreated}
            onChange={setOnConversationCreated}
          />
          <EventCheckbox
            id="evt-conv-closed"
            label="Conversation closed"
            description="When a conversation is resolved"
            checked={onConversationClosed}
            onChange={setOnConversationClosed}
          />
          <EventCheckbox
            id="evt-conv-assigned"
            label="Conversation assigned"
            description="When a conversation is assigned to a team member"
            checked={onConversationAssigned}
            onChange={setOnConversationAssigned}
          />
        </div>
      </div>

      <Button
        onClick={() =>
          onSubmit({
            name,
            description,
            webhookUrl,
            creatorName,
            events: {
              onMessageCreated,
              onConversationCreated,
              onConversationClosed,
              onConversationAssigned,
            },
          })
        }
        disabled={isPending || !canSubmit}
        className="w-full"
      >
        {isPending ? (
          <>
            <Icons.spinner className="mr-2 size-4 animate-spin" />
            Installing...
          </>
        ) : (
          "Install Agent"
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Credentials Banner (one-time)
// ---------------------------------------------------------------------------

function CredentialsBanner({
  credentials,
  onDismiss,
}: {
  credentials: {
    agentName: string;
    webhookSecret: string;
    apiKey: string;
  };
  onDismiss: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
      <h3 className="font-medium text-amber-800 dark:text-amber-200">
        &ldquo;{credentials.agentName}&rdquo; Installed — Save These Credentials
      </h3>
      <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
        These will not be shown again. Your agent needs both to operate.
      </p>

      <div className="mt-4 space-y-3">
        {/* Webhook Secret */}
        <div>
          <Label className="text-xs text-amber-700 dark:text-amber-300">
            Webhook Signing Secret
          </Label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-3 py-2 font-mono text-xs dark:bg-black">
              {credentials.webhookSecret}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copyToClipboard(credentials.webhookSecret, "Webhook secret")
              }
            >
              <Copy className="mr-1 size-3" />
              Copy
            </Button>
          </div>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Verify webhook signatures with the{" "}
            <code className="rounded bg-white/50 px-1 dark:bg-black/50">
              X-GudDesk-Signature
            </code>{" "}
            header.
          </p>
        </div>

        {/* API Key */}
        <div>
          <Label className="text-xs text-amber-700 dark:text-amber-300">
            API Key (READ_WRITE, scoped to this workspace)
          </Label>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-3 py-2 font-mono text-xs dark:bg-black">
              {showApiKey ? credentials.apiKey : `${credentials.apiKey.slice(0, 8)}${"*".repeat(32)}`}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? (
                <EyeOff className="size-3" />
              ) : (
                <Eye className="size-3" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copyToClipboard(credentials.apiKey, "API key")
              }
            >
              <Copy className="mr-1 size-3" />
              Copy
            </Button>
          </div>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Use this key in the{" "}
            <code className="rounded bg-white/50 px-1 dark:bg-black/50">
              Authorization: Bearer
            </code>{" "}
            header to call the GudDesk API.
          </p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-3"
        onClick={onDismiss}
      >
        I&apos;ve saved these credentials — dismiss
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function EventToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function EventCheckbox({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium leading-none">
          {label}
        </label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask the middle of a URL for display: https://ex*****.com/webhook */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host.length <= 8) return url;
    return `${u.protocol}//${host.slice(0, 4)}${"*".repeat(5)}${host.slice(-4)}${u.pathname}`;
  } catch {
    return url;
  }
}
