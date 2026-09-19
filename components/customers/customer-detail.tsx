"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { updateCustomer } from "@/actions/update-customer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/shared/icons";
import {
  CustomFieldsDisplay,
  CustomFieldsForm,
  type CustomFieldDef,
} from "@/components/shared/custom-fields-display";
import { CustomerTimeline } from "@/components/customers/customer-timeline";
import { timeAgo } from "@/lib/utils";

type Conversation = {
  id: string;
  status: string;
  subject: string | null;
  tags: string[];
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  createdAt: Date;
};

type CompanyInfo = {
  id: string;
  name: string;
  domain: string | null;
};

type CustomerEventItem = {
  id: string;
  type: string;
  title: string;
  metadata: unknown;
  createdAt: Date;
};

type Customer = {
  id: string;
  externalId: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  companyId: string | null;
  metadata: unknown;
  lastSeenAt: Date | null;
  createdAt: Date;
  company: CompanyInfo | null;
  conversations: Conversation[];
  _count: { conversations: number };
};

interface CustomerDetailProps {
  customer: Customer;
  workspaceId: string;
  workspaceSlug: string;
  companies: CompanyInfo[];
  customFields?: CustomFieldDef[];
  events?: CustomerEventItem[];
}

const statusColors: Record<string, string> = {
  OPEN: "bg-green-500/10 text-green-700 dark:text-green-400",
  SNOOZED: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CLOSED: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
};

export function CustomerDetail({
  customer,
  workspaceId,
  workspaceSlug,
  companies,
  customFields = [],
  events = [],
}: CustomerDetailProps) {
  const displayName = customer.name || customer.email || "Anonymous Visitor";
  const initials = displayName.slice(0, 2).toUpperCase();

  const metadata =
    customer.metadata && typeof customer.metadata === "object"
      ? (customer.metadata as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarImage
                src={customer.avatarUrl ?? undefined}
                alt={displayName}
              />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{displayName}</h2>
              {customer.name && customer.email && (
                <p className="text-sm text-muted-foreground">
                  {customer.email}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                {customer.externalId && (
                  <Badge variant="outline" className="text-xs">
                    ID: {customer.externalId}
                  </Badge>
                )}
                {customer.company && (
                  <Link
                    href={`/workspace/${workspaceSlug}/companies/${customer.company.id}`}
                  >
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-xs hover:bg-secondary/80"
                    >
                      <Icons.building className="mr-1 size-3" />
                      {customer.company.name}
                    </Badge>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <EditCustomerDialog
            customer={customer}
            workspaceId={workspaceId}
            metadata={metadata}
            companies={companies}
            customFields={customFields}
          />
        </div>

        {/* Info grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem
            label="Conversations"
            value={String(customer._count.conversations)}
          />
          <InfoItem
            label="First seen"
            value={timeAgo(customer.createdAt)}
          />
          <InfoItem
            label="Last seen"
            value={customer.lastSeenAt ? timeAgo(customer.lastSeenAt) : "Never"}
          />
          <InfoItem
            label="External ID"
            value={customer.externalId || "—"}
          />
        </div>

        {/* Custom fields + extra metadata display */}
        <CustomFieldsDisplay fields={customFields} metadata={metadata} />
      </div>

      {/* Activity Timeline */}
      <div>
        <h3 className="mb-3 text-sm font-medium">
          Activity ({events.length})
        </h3>
        <CustomerTimeline events={events} />
      </div>

      {/* Conversations */}
      <div>
        <h3 className="mb-3 text-sm font-medium">
          Conversations ({customer._count.conversations})
        </h3>
        <div className="rounded-lg border">
          {customer.conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No conversations yet.
            </div>
          ) : (
            <div className="divide-y">
              {customer.conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/workspace/${workspaceSlug}/inbox`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${statusColors[conv.status] || ""}`}
                      >
                        {conv.status}
                      </Badge>
                      <span className="truncate text-sm font-medium">
                        {conv.subject || "No subject"}
                      </span>
                    </div>
                    {conv.lastMessagePreview && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  <span className="ml-4 shrink-0 text-xs text-muted-foreground">
                    {conv.lastMessageAt
                      ? timeAgo(conv.lastMessageAt)
                      : timeAgo(conv.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EditCustomerDialog({
  customer,
  workspaceId,
  metadata,
  companies,
  customFields,
}: {
  customer: Customer;
  workspaceId: string;
  metadata: Record<string, unknown> | null;
  companies: CompanyInfo[];
  customFields: CustomFieldDef[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(customer.name ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [companyId, setCompanyId] = useState(customer.companyId ?? "none");

  // Custom field values — initialized from metadata
  const [fieldValues, setFieldValues] = useState<Record<string, unknown>>(
    () => {
      const vals: Record<string, unknown> = {};
      for (const f of customFields) {
        vals[f.key] = metadata?.[f.key] ?? null;
      }
      return vals;
    },
  );

  // Extra metadata keys not covered by custom fields
  const definedKeys = new Set(customFields.map((f) => f.key));
  const extraMetadata: Record<string, unknown> = {};
  if (metadata) {
    for (const [k, v] of Object.entries(metadata)) {
      if (!definedKeys.has(k)) {
        extraMetadata[k] = v;
      }
    }
  }
  const [extraMetaStr, setExtraMetaStr] = useState(
    Object.keys(extraMetadata).length > 0
      ? JSON.stringify(extraMetadata, null, 2)
      : "",
  );

  function handleFieldChange(key: string, value: unknown) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    // Build combined metadata: custom field values + extra raw metadata
    const combinedMeta: Record<string, unknown> = {};

    // Add custom field values (skip nulls for cleanliness)
    for (const [k, v] of Object.entries(fieldValues)) {
      if (v !== null && v !== undefined && v !== "") {
        combinedMeta[k] = v;
      }
    }

    // Merge extra metadata
    if (extraMetaStr.trim()) {
      try {
        const extra = JSON.parse(extraMetaStr);
        Object.assign(combinedMeta, extra);
      } catch {
        toast.error("Invalid JSON in extra metadata field");
        return;
      }
    }

    const finalMeta =
      Object.keys(combinedMeta).length > 0 ? combinedMeta : null;

    startTransition(async () => {
      const result = await updateCustomer(workspaceId, customer.id, {
        name: name.trim() || null,
        email: email.trim() || null,
        companyId: companyId === "none" ? null : companyId,
        metadata: finalMeta,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success("Customer updated");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>
            Update this customer&apos;s profile information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-company">Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger id="edit-company">
                <SelectValue placeholder="No company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.domain ? ` (${c.domain})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom fields form */}
          <CustomFieldsForm
            fields={customFields}
            values={fieldValues}
            onChange={handleFieldChange}
          />

          {/* Extra metadata (raw JSON for keys not covered by custom fields) */}
          {Object.keys(extraMetadata).length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="edit-extra-metadata">
                Other Metadata (JSON)
              </Label>
              <Textarea
                id="edit-extra-metadata"
                value={extraMetaStr}
                onChange={(e) => setExtraMetaStr(e.target.value)}
                rows={3}
                className="font-mono text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && (
              <Icons.spinner className="mr-1.5 size-4 animate-spin" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
