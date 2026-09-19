"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { updateCompany, deleteCompany } from "@/actions/manage-company";
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
import { Textarea } from "@/components/ui/textarea";
import { Icons } from "@/components/shared/icons";
import {
  CustomFieldsDisplay,
  CustomFieldsForm,
  type CustomFieldDef,
} from "@/components/shared/custom-fields-display";
import { timeAgo } from "@/lib/utils";

type CompanyVisitor = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastSeenAt: Date | null;
  _count: { conversations: number };
};

type Company = {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  logoUrl: string | null;
  industry: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  visitors: CompanyVisitor[];
  _count: { visitors: number };
};

interface CompanyDetailProps {
  company: Company;
  workspaceId: string;
  workspaceSlug: string;
  customFields?: CustomFieldDef[];
}

export function CompanyDetail({
  company,
  workspaceId,
  workspaceSlug,
  customFields = [],
}: CompanyDetailProps) {
  const initials = company.name.slice(0, 2).toUpperCase();

  const metadata =
    company.metadata && typeof company.metadata === "object"
      ? (company.metadata as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarImage
                src={company.logoUrl ?? undefined}
                alt={company.name}
              />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{company.name}</h2>
              {company.domain && (
                <p className="text-sm text-muted-foreground">
                  {company.domain}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                {company.industry && (
                  <Badge variant="outline" className="text-xs">
                    {company.industry}
                  </Badge>
                )}
                {company.website && (
                  <a
                    href={
                      company.website.startsWith("http")
                        ? company.website
                        : `https://${company.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    {company.website}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <EditCompanyDialog
              company={company}
              workspaceId={workspaceId}
              metadata={metadata}
              customFields={customFields}
            />
            <DeleteCompanyButton
              company={company}
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug}
            />
          </div>
        </div>

        {/* Info grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <InfoItem
            label="Customers"
            value={String(company._count.visitors)}
          />
          <InfoItem label="Domain" value={company.domain || "—"} />
          <InfoItem label="Industry" value={company.industry || "—"} />
          <InfoItem label="Created" value={timeAgo(company.createdAt)} />
        </div>

        {/* Custom fields + extra metadata display */}
        <CustomFieldsDisplay fields={customFields} metadata={metadata} />
      </div>

      {/* Customers */}
      <div>
        <h3 className="mb-3 text-sm font-medium">
          Customers ({company._count.visitors})
        </h3>
        <div className="rounded-lg border">
          {company.visitors.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No customers linked to this company yet.
            </div>
          ) : (
            <div className="divide-y">
              {company.visitors.map((visitor) => {
                const displayName =
                  visitor.name || visitor.email || "Anonymous Visitor";
                const visitorInitials = displayName
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <Link
                    key={visitor.id}
                    href={`/workspace/${workspaceSlug}/customers/${visitor.id}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage
                          src={visitor.avatarUrl ?? undefined}
                          alt={displayName}
                        />
                        <AvatarFallback className="text-xs">
                          {visitorInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="truncate text-sm font-medium">
                          {displayName}
                        </span>
                        {visitor.name && visitor.email && (
                          <p className="truncate text-xs text-muted-foreground">
                            {visitor.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0 text-xs text-muted-foreground">
                      <span>
                        {visitor._count.conversations}{" "}
                        {visitor._count.conversations === 1
                          ? "conversation"
                          : "conversations"}
                      </span>
                      <span className="w-20 text-right">
                        {visitor.lastSeenAt
                          ? timeAgo(visitor.lastSeenAt)
                          : "Never"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        {company._count.visitors > 50 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Showing 50 of {company._count.visitors} customers
          </p>
        )}
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

function EditCompanyDialog({
  company,
  workspaceId,
  metadata,
  customFields,
}: {
  company: Company;
  workspaceId: string;
  metadata: Record<string, unknown> | null;
  customFields: CustomFieldDef[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(company.name);
  const [domain, setDomain] = useState(company.domain ?? "");
  const [website, setWebsite] = useState(company.website ?? "");
  const [industry, setIndustry] = useState(company.industry ?? "");
  const [logoUrl, setLogoUrl] = useState(company.logoUrl ?? "");

  // Custom field values
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
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }

    // Build combined metadata
    const combinedMeta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fieldValues)) {
      if (v !== null && v !== undefined && v !== "") {
        combinedMeta[k] = v;
      }
    }
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
      const result = await updateCompany(workspaceId, company.id, {
        name: name.trim(),
        domain: domain.trim() || null,
        website: website.trim() || null,
        logoUrl: logoUrl.trim() || null,
        industry: industry.trim() || null,
        metadata: finalMeta,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success("Company updated");
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
          <DialogTitle>Edit Company</DialogTitle>
          <DialogDescription>
            Update this company&apos;s profile information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-company-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Company name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-company-domain">Domain</Label>
            <Input
              id="edit-company-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-company-industry">Industry</Label>
            <Input
              id="edit-company-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="SaaS, Healthcare, Finance..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-company-website">Website</Label>
            <Input
              id="edit-company-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-company-logo">Logo URL</Label>
            <Input
              id="edit-company-logo"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          {/* Custom fields form */}
          <CustomFieldsForm
            fields={customFields}
            values={fieldValues}
            onChange={handleFieldChange}
          />

          {/* Extra metadata */}
          {Object.keys(extraMetadata).length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="edit-company-extra-metadata">
                Other Metadata (JSON)
              </Label>
              <Textarea
                id="edit-company-extra-metadata"
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

function DeleteCompanyButton({
  company,
  workspaceId,
  workspaceSlug,
}: {
  company: Company;
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCompany(workspaceId, company.id);

      if (result.status === "error") {
        toast.error(result.message);
        setConfirming(false);
        return;
      }

      toast.success("Company deleted");
      router.push(`/workspace/${workspaceSlug}/companies`);
    });
  }

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending && (
          <Icons.spinner className="mr-1.5 size-4 animate-spin" />
        )}
        Confirm Delete
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirming(false)}
        disabled={isPending}
      >
        Cancel
      </Button>
    </div>
  );
}
