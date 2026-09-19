"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { CustomFieldType } from "@prisma/client";

import {
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from "@/actions/manage-custom-fields";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Icons } from "@/components/shared/icons";

type CustomField = {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  fieldType: CustomFieldType;
  entityType: string;
  isRequired: boolean;
  enumOptions: string[];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

interface CustomFieldsManagerProps {
  fields: CustomField[];
  workspaceId: string;
}

const fieldTypeLabels: Record<CustomFieldType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  BOOLEAN: "Boolean",
  DATE: "Date",
  ENUM: "Dropdown",
};

const fieldTypeColors: Record<CustomFieldType, string> = {
  TEXT: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  NUMBER: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  BOOLEAN: "bg-green-500/10 text-green-700 dark:text-green-400",
  DATE: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  ENUM: "bg-pink-500/10 text-pink-700 dark:text-pink-400",
};

export function CustomFieldsManager({
  fields,
  workspaceId,
}: CustomFieldsManagerProps) {
  const customerFields = fields.filter((f) => f.entityType === "customer");
  const companyFields = fields.filter((f) => f.entityType === "company");

  return (
    <Tabs defaultValue="customer" className="space-y-4">
      <TabsList>
        <TabsTrigger value="customer">
          Customer Fields ({customerFields.length})
        </TabsTrigger>
        <TabsTrigger value="company">
          Company Fields ({companyFields.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="customer" className="space-y-4">
        <div className="flex justify-end">
          <CreateFieldDialog
            workspaceId={workspaceId}
            entityType="customer"
          />
        </div>
        <FieldList
          fields={customerFields}
          workspaceId={workspaceId}
          emptyMessage="No customer fields defined yet. Create one to add structured attributes to customer profiles."
        />
      </TabsContent>

      <TabsContent value="company" className="space-y-4">
        <div className="flex justify-end">
          <CreateFieldDialog
            workspaceId={workspaceId}
            entityType="company"
          />
        </div>
        <FieldList
          fields={companyFields}
          workspaceId={workspaceId}
          emptyMessage="No company fields defined yet. Create one to add structured attributes to company profiles."
        />
      </TabsContent>
    </Tabs>
  );
}

function FieldList({
  fields,
  workspaceId,
  emptyMessage,
}: {
  fields: CustomField[];
  workspaceId: string;
  emptyMessage: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(fieldId: string, fieldName: string) {
    if (!confirm(`Delete field "${fieldName}"? This won't remove existing values from metadata.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCustomField(workspaceId, fieldId);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success("Field deleted");
    });
  }

  if (fields.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="divide-y">
        {fields.map((field) => (
          <div
            key={field.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.name}</span>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${fieldTypeColors[field.fieldType]}`}
                  >
                    {fieldTypeLabels[field.fieldType]}
                  </Badge>
                  {field.isRequired && (
                    <Badge variant="outline" className="text-xs">
                      Required
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-muted-foreground">
                    metadata.{field.key}
                  </code>
                  {field.fieldType === "ENUM" &&
                    field.enumOptions.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        · {field.enumOptions.join(", ")}
                      </span>
                    )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <EditFieldDialog field={field} workspaceId={workspaceId} />
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(field.id, field.name)}
                disabled={isPending}
              >
                <Icons.trash className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateFieldDialog({
  workspaceId,
  entityType,
}: {
  workspaceId: string;
  entityType: "customer" | "company";
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("TEXT");
  const [isRequired, setIsRequired] = useState(false);
  const [enumOptionsStr, setEnumOptionsStr] = useState("");

  // Auto-generate key from name
  function handleNameChange(value: string) {
    setName(value);
    // Generate key: lowercase, replace spaces/special chars with underscores
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    setKey(generated);
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("Field name is required");
      return;
    }
    if (!key.trim()) {
      toast.error("Field key is required");
      return;
    }

    const enumOptions =
      fieldType === "ENUM"
        ? enumOptionsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    if (fieldType === "ENUM" && enumOptions.length === 0) {
      toast.error("Provide at least one dropdown option (comma-separated)");
      return;
    }

    startTransition(async () => {
      const result = await createCustomField(workspaceId, {
        name: name.trim(),
        key: key.trim(),
        fieldType,
        entityType,
        isRequired,
        enumOptions,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success("Field created");
      setOpen(false);
      setName("");
      setKey("");
      setFieldType("TEXT");
      setIsRequired(false);
      setEnumOptionsStr("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Icons.add className="mr-1.5 size-4" />
          New {entityType === "customer" ? "Customer" : "Company"} Field
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Field</DialogTitle>
          <DialogDescription>
            Define a new {entityType} attribute. Values will be stored in
            the {entityType}&apos;s metadata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">
              Display Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Plan, Account Manager, MRR"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-key">
              Key <span className="text-destructive">*</span>
            </Label>
            <Input
              id="field-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. plan, account_manager, mrr"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Stored in metadata.{key || "key"}. Lowercase letters, numbers, and
              underscores.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-type">Type</Label>
            <Select
              value={fieldType}
              onValueChange={(v) => setFieldType(v as CustomFieldType)}
            >
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TEXT">Text</SelectItem>
                <SelectItem value="NUMBER">Number</SelectItem>
                <SelectItem value="BOOLEAN">Boolean (Yes/No)</SelectItem>
                <SelectItem value="DATE">Date</SelectItem>
                <SelectItem value="ENUM">Dropdown (Enum)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {fieldType === "ENUM" && (
            <div className="space-y-2">
              <Label htmlFor="enum-options">
                Options <span className="text-destructive">*</span>
              </Label>
              <Input
                id="enum-options"
                value={enumOptionsStr}
                onChange={(e) => setEnumOptionsStr(e.target.value)}
                placeholder="Free, Pro, Enterprise"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of dropdown options.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="field-required"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="size-4 rounded border-gray-300"
            />
            <Label htmlFor="field-required" className="text-sm font-normal">
              Required field
            </Label>
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
            Create Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditFieldDialog({
  field,
  workspaceId,
}: {
  field: CustomField;
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(field.name);
  const [isRequired, setIsRequired] = useState(field.isRequired);
  const [enumOptionsStr, setEnumOptionsStr] = useState(
    field.enumOptions.join(", "),
  );

  function handleSave() {
    if (!name.trim()) {
      toast.error("Field name is required");
      return;
    }

    const enumOptions =
      field.fieldType === "ENUM"
        ? enumOptionsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    startTransition(async () => {
      const result = await updateCustomField(workspaceId, field.id, {
        name: name.trim(),
        isRequired,
        enumOptions,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success("Field updated");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Field</DialogTitle>
          <DialogDescription>
            Update the display name and options. The key and type cannot be
            changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-field-name">Display Name</Label>
            <Input
              id="edit-field-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Field name"
            />
          </div>

          <div className="space-y-2">
            <Label>Key</Label>
            <code className="block rounded-md bg-muted px-3 py-2 text-sm">
              {field.key}
            </code>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <p className="text-sm">
              {fieldTypeLabels[field.fieldType]}
            </p>
          </div>

          {field.fieldType === "ENUM" && (
            <div className="space-y-2">
              <Label htmlFor="edit-enum-options">Options</Label>
              <Input
                id="edit-enum-options"
                value={enumOptionsStr}
                onChange={(e) => setEnumOptionsStr(e.target.value)}
                placeholder="Option1, Option2, Option3"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-field-required"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="size-4 rounded border-gray-300"
            />
            <Label htmlFor="edit-field-required" className="text-sm font-normal">
              Required field
            </Label>
          </div>
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
