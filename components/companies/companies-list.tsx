"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { createCompany } from "@/actions/manage-company";
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
import { Icons } from "@/components/shared/icons";

type Company = {
  id: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  industry: string | null;
  createdAt: Date;
  _count: { visitors: number };
};

interface CompaniesListProps {
  companies: Company[];
  workspaceId: string;
  workspaceSlug: string;
  total: number;
  totalPages: number;
  page: number;
}

export function CompaniesList({
  companies,
  workspaceId,
  workspaceSlug,
  total,
  totalPages,
  page,
}: CompaniesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when search changes
    if (key !== "page") params.delete("page");
    router.push(`/workspace/${workspaceSlug}/companies?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Search + Create */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Icons.search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, domain, or industry..."
            defaultValue={searchParams.get("search") ?? ""}
            onChange={(e) => {
              const timeout = setTimeout(
                () => updateParams("search", e.target.value),
                300,
              );
              return () => clearTimeout(timeout);
            }}
            className="pl-9"
          />
        </div>
        <CreateCompanyDialog
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
        />
      </div>

      {/* Company count */}
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "0 companies"
          : `Showing ${(page - 1) * 25 + 1}–${Math.min(page * 25, total)} of ${total} ${total === 1 ? "company" : "companies"}`}
        {searchParams.get("search") &&
          ` matching "${searchParams.get("search")}"`}
      </p>

      {/* Company list */}
      <div className="rounded-lg border">
        {companies.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {!searchParams.get("search")
              ? "No companies yet. Companies are created automatically when identified customers have business email domains, or you can create them manually."
              : "No companies match your search."}
          </div>
        ) : (
          <div className="divide-y">
            {companies.map((company) => {
              const initials = company.name.slice(0, 2).toUpperCase();

              return (
                <Link
                  key={company.id}
                  href={`/workspace/${workspaceSlug}/companies/${company.id}`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage
                        src={company.logoUrl ?? undefined}
                        alt={company.name}
                      />
                      <AvatarFallback className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {company.name}
                        </span>
                        {company.domain && (
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0"
                          >
                            {company.domain}
                          </Badge>
                        )}
                      </div>
                      {company.industry && (
                        <p className="truncate text-xs text-muted-foreground">
                          {company.industry}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-xs text-muted-foreground">
                    <span>
                      {company._count.visitors}{" "}
                      {company._count.visitors === 1 ? "customer" : "customers"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParams("page", String(page - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => updateParams("page", String(page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateCompanyDialog({
  workspaceId,
  workspaceSlug,
}: {
  workspaceId: string;
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Company name is required");
      return;
    }

    startTransition(async () => {
      const result = await createCompany(workspaceId, {
        name: name.trim(),
        domain: domain.trim() || null,
        website: website.trim() || null,
        industry: industry.trim() || null,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success("Company created");
      setOpen(false);
      setName("");
      setDomain("");
      setIndustry("");
      setWebsite("");

      // Navigate to the new company
      if (result.companyId) {
        router.push(
          `/workspace/${workspaceSlug}/companies/${result.companyId}`,
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Icons.add className="mr-1.5 size-4" />
          New Company
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Company</DialogTitle>
          <DialogDescription>
            Add a new company to group customers by organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-domain">Domain</Label>
            <Input
              id="company-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
            />
            <p className="text-xs text-muted-foreground">
              Customers with this email domain will be auto-assigned.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-industry">Industry</Label>
            <Input
              id="company-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="SaaS, Healthcare, Finance..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company-website">Website</Label>
            <Input
              id="company-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isPending}>
            {isPending && (
              <Icons.spinner className="mr-1.5 size-4 animate-spin" />
            )}
            Create Company
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
