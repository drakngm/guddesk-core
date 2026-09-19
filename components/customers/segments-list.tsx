"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { CustomFieldType } from "@prisma/client";

import {
  createSegment,
  deleteSegment,
} from "@/actions/manage-segments";
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
import { SegmentBuilder, type SegmentCondition } from "./segment-builder";
import { timeAgo } from "@/lib/utils";

type Segment = {
  id: string;
  name: string;
  description: string | null;
  conditions: unknown;
  color: string | null;
  createdAt: Date;
  customerCount: number;
};

type CustomFieldOption = {
  id: string;
  name: string;
  key: string;
  fieldType: CustomFieldType;
  enumOptions: string[];
};

interface SegmentsListProps {
  segments: Segment[];
  workspaceId: string;
  workspaceSlug: string;
  customFields: CustomFieldOption[];
}

export function SegmentsList({
  segments,
  workspaceId,
  workspaceSlug,
  customFields,
}: SegmentsListProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(segmentId: string, segmentName: string) {
    if (!confirm(`Delete segment "${segmentName}"?`)) return;

    startTransition(async () => {
      const result = await deleteSegment(workspaceId, segmentId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Segment deleted");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateSegmentDialog
          workspaceId={workspaceId}
          customFields={customFields}
        />
      </div>

      {segments.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          No segments yet. Create one to group customers by specific conditions.
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="divide-y">
            {segments.map((segment) => {
              const conditions = (segment.conditions as SegmentCondition[]) || [];

              return (
                <div
                  key={segment.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {segment.color && (
                        <div
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: segment.color }}
                        />
                      )}
                      <Link
                        href={`/workspace/${workspaceSlug}/customers?segment=${segment.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {segment.name}
                      </Link>
                      <Badge variant="secondary" className="text-xs">
                        {segment.customerCount}{" "}
                        {segment.customerCount === 1 ? "customer" : "customers"}
                      </Badge>
                    </div>
                    {segment.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {segment.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {conditions.length}{" "}
                      {conditions.length === 1 ? "condition" : "conditions"} ·
                      Created {timeAgo(segment.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/workspace/${workspaceSlug}/customers?segment=${segment.id}`}
                    >
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(segment.id, segment.name)}
                      disabled={isPending}
                    >
                      <Icons.trash className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateSegmentDialog({
  workspaceId,
  customFields,
}: {
  workspaceId: string;
  customFields: CustomFieldOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [conditions, setConditions] = useState<SegmentCondition[]>([
    { field: "email", operator: "contains", value: "" },
  ]);

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Segment name is required");
      return;
    }

    // Filter out empty conditions
    const validConditions = conditions.filter(
      (c) =>
        c.field &&
        c.operator &&
        (c.operator === "is_set" ||
          c.operator === "is_not_set" ||
          (c.value !== undefined && c.value !== null && c.value !== "")),
    );

    if (validConditions.length === 0) {
      toast.error("At least one valid condition is required");
      return;
    }

    startTransition(async () => {
      const result = await createSegment(workspaceId, {
        name: name.trim(),
        description: description.trim() || null,
        conditions: validConditions,
        color: color || null,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success("Segment created");
      setOpen(false);
      setName("");
      setDescription("");
      setConditions([{ field: "email", operator: "contains", value: "" }]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Icons.add className="mr-1.5 size-4" />
          New Segment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Segment</DialogTitle>
          <DialogDescription>
            Define conditions to group customers. All conditions are combined
            with AND logic.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="segment-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="segment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Enterprise Customers"
              />
            </div>
            <div className="w-20 space-y-2">
              <Label htmlFor="segment-color">Color</Label>
              <Input
                id="segment-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 p-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment-description">Description</Label>
            <Input
              id="segment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <Label>Conditions</Label>
            <SegmentBuilder
              conditions={conditions}
              onChange={setConditions}
              customFields={customFields}
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
            Create Segment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
