"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icons } from "@/components/shared/icons";
import { timeAgo } from "@/lib/utils";

type Customer = {
  id: string;
  externalId: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  _count: { conversations: number };
};

type SegmentOption = {
  id: string;
  name: string;
  color: string | null;
};

interface CustomersListProps {
  customers: Customer[];
  workspaceSlug: string;
  total: number;
  totalPages: number;
  page: number;
  segments?: SegmentOption[];
  activeSegment?: { id: string; name: string; color: string | null } | null;
}

export function CustomersList({
  customers,
  workspaceSlug,
  total,
  totalPages,
  page,
  segments = [],
  activeSegment = null,
}: CustomersListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    if (key !== "page") params.delete("page");
    router.push(`/workspace/${workspaceSlug}/customers?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Search + Segment filter */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Icons.search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or ID..."
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

        {segments.length > 0 && (
          <Select
            value={activeSegment?.id ?? "all"}
            onValueChange={(v) => updateParams("segment", v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {segments.map((seg) => (
                <SelectItem key={seg.id} value={seg.id}>
                  <div className="flex items-center gap-2">
                    {seg.color && (
                      <div
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: seg.color }}
                      />
                    )}
                    {seg.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Active segment badge */}
      {activeSegment && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {activeSegment.color && (
              <div
                className="mr-1 size-2 rounded-full"
                style={{ backgroundColor: activeSegment.color }}
              />
            )}
            Segment: {activeSegment.name}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => updateParams("segment", "")}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Customer count */}
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? "0 customers"
          : `Showing ${(page - 1) * 25 + 1}–${Math.min(page * 25, total)} of ${total} ${total === 1 ? "customer" : "customers"}`}
        {searchParams.get("search") && ` matching "${searchParams.get("search")}"`}
      </p>

      {/* Customer list */}
      <div className="rounded-lg border">
        {customers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {!searchParams.get("search") && !activeSegment
              ? "No customers yet. Customers appear here when visitors interact with your chat widget."
              : activeSegment
                ? "No customers match this segment."
                : "No customers match your search."}
          </div>
        ) : (
          <div className="divide-y">
            {customers.map((customer) => {
              const displayName =
                customer.name || customer.email || "Anonymous Visitor";
              const initials = displayName.slice(0, 2).toUpperCase();

              return (
                <Link
                  key={customer.id}
                  href={`/workspace/${workspaceSlug}/customers/${customer.id}`}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage
                        src={customer.avatarUrl ?? undefined}
                        alt={displayName}
                      />
                      <AvatarFallback className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {displayName}
                        </span>
                        {customer.externalId && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {customer.externalId}
                          </Badge>
                        )}
                      </div>
                      {customer.name && customer.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {customer.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-xs text-muted-foreground">
                    <span className="hidden sm:inline">
                      {customer._count.conversations}{" "}
                      {customer._count.conversations === 1
                        ? "conversation"
                        : "conversations"}
                    </span>
                    <span className="w-20 text-right">
                      {customer.lastSeenAt
                        ? timeAgo(customer.lastSeenAt)
                        : "Never"}
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
