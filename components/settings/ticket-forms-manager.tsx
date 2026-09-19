"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TicketForm, CustomField } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import {
  createTicketForm,
  updateTicketForm,
  deleteTicketForm,
} from "@/actions/manage-ticket-forms";

interface Props {
  forms: TicketForm[];
  customFields: CustomField[];
  workspaceId: string;
}

export function TicketFormsManager({ forms, customFields, workspaceId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(formId: string) {
    if (!confirm("Delete this ticket form?")) return;
    startTransition(async () => {
      const result = await deleteTicketForm(workspaceId, formId);
      if (result.status === "error") {
        toast.error(result.message);
      } else {
        toast.success("Form deleted");
      }
    });
  }

  function handleToggle(formId: string, isEnabled: boolean) {
    startTransition(async () => {
      const result = await updateTicketForm(workspaceId, formId, { isEnabled: !isEnabled });
      if (result.status === "error") {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Ticket Forms</CardTitle>
          <CardDescription>
            Define which custom fields appear when visitors submit tickets.
            {customFields.length === 0 && (
              <span className="block mt-1 text-amber-600">
                Create &quot;conversation&quot; type custom fields first in Custom Fields settings.
              </span>
            )}
          </CardDescription>
        </div>
        <CreateFormDialog
          workspaceId={workspaceId}
          customFields={customFields}
        />
      </CardHeader>
      <CardContent>
        {forms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ticket forms configured yet. Create one to define structured intake forms.
          </p>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => (
              <div
                key={form.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{form.name}</span>
                    {form.isDefault && <Badge variant="secondary">Default</Badge>}
                    <Badge variant={form.isEnabled ? "default" : "outline"}>
                      {form.isEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  {form.description && (
                    <p className="text-sm text-muted-foreground">{form.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {form.fieldKeys.length} field{form.fieldKeys.length !== 1 ? "s" : ""}:{" "}
                    {form.fieldKeys.join(", ") || "none"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(form.id, form.isEnabled)}
                    disabled={isPending}
                  >
                    {form.isEnabled ? "Disable" : "Enable"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(form.id)}
                    disabled={isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreateFormDialog({
  workspaceId,
  customFields,
}: {
  workspaceId: string;
  customFields: CustomField[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  function toggleField(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await createTicketForm(workspaceId, {
        name,
        description: description || null,
        fieldKeys: selectedKeys,
        isDefault,
      });

      if (result.status === "error") {
        toast.error(result.message);
      } else {
        toast.success("Ticket form created");
        setOpen(false);
        setName("");
        setDescription("");
        setSelectedKeys([]);
        setIsDefault(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New Form</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Ticket Form</DialogTitle>
          <DialogDescription>
            Select which fields visitors fill out when submitting a ticket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Form Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bug Report"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Fields</Label>
            {customFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conversation-type custom fields available. Create them in Custom Fields settings.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {customFields.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-2 rounded border p-2 cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                      className="rounded"
                    />
                    <span className="text-sm">{field.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {field.fieldType}
                    </Badge>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="formIsDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="formIsDefault">Set as default form</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending ? "Creating..." : "Create Form"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
