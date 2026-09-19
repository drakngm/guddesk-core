"use client";

import type { CustomFieldType } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CustomFieldDef = {
  id: string;
  name: string;
  key: string;
  fieldType: CustomFieldType;
  entityType: string;
  isRequired: boolean;
  enumOptions: string[];
  displayOrder: number;
};

/**
 * Renders custom fields as read-only display cards.
 * Shows defined fields with their values from metadata,
 * plus any extra metadata keys not covered by field definitions.
 */
export function CustomFieldsDisplay({
  fields,
  metadata,
}: {
  fields: CustomFieldDef[];
  metadata: Record<string, unknown> | null;
}) {
  if (fields.length === 0 && (!metadata || Object.keys(metadata).length === 0)) {
    return null;
  }

  // Keys covered by defined fields
  const definedKeys = new Set(fields.map((f) => f.key));

  // Extra metadata keys not covered by field definitions
  const extraKeys = metadata
    ? Object.keys(metadata).filter((k) => !definedKeys.has(k))
    : [];

  return (
    <div className="mt-6">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
        Attributes
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {/* Defined custom fields */}
        {fields.map((field) => {
          const value = metadata?.[field.key];
          return (
            <div
              key={field.id}
              className="rounded-md bg-muted/50 px-3 py-2 text-sm"
            >
              <span className="text-xs text-muted-foreground">
                {field.name}
              </span>
              <p className="truncate font-medium">
                {formatFieldValue(field.fieldType, value)}
              </p>
            </div>
          );
        })}

        {/* Extra metadata not covered by field definitions */}
        {extraKeys.map((key) => (
          <div
            key={key}
            className="rounded-md bg-muted/50 px-3 py-2 text-sm"
          >
            <span className="text-xs text-muted-foreground">{key}</span>
            <p className="truncate font-medium">
              {formatRawValue(metadata![key])}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders custom fields as editable form inputs.
 * Used inside edit dialogs for customers and companies.
 */
export function CustomFieldsForm({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">Custom Fields</Label>
        <Badge variant="secondary" className="text-xs">
          {fields.length}
        </Badge>
      </div>
      {fields.map((field) => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={values[field.key]}
          onChange={(val) => onChange(field.key, val)}
        />
      ))}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `cf-${field.key}`;

  switch (field.fieldType) {
    case "TEXT":
      return (
        <div className="space-y-1">
          <Label htmlFor={id} className="text-xs">
            {field.name}
            {field.isRequired && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={id}
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || null)}
            placeholder={field.name}
            className="h-8 text-sm"
          />
        </div>
      );

    case "NUMBER":
      return (
        <div className="space-y-1">
          <Label htmlFor={id} className="text-xs">
            {field.name}
            {field.isRequired && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={id}
            type="number"
            value={value !== null && value !== undefined ? String(value) : ""}
            onChange={(e) => {
              const num = e.target.value ? Number(e.target.value) : null;
              onChange(num);
            }}
            placeholder={field.name}
            className="h-8 text-sm"
          />
        </div>
      );

    case "BOOLEAN":
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={id}
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 rounded border-gray-300"
          />
          <Label htmlFor={id} className="text-xs font-normal">
            {field.name}
            {field.isRequired && <span className="text-destructive"> *</span>}
          </Label>
        </div>
      );

    case "DATE":
      return (
        <div className="space-y-1">
          <Label htmlFor={id} className="text-xs">
            {field.name}
            {field.isRequired && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={id}
            type="date"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="h-8 text-sm"
          />
        </div>
      );

    case "ENUM":
      return (
        <div className="space-y-1">
          <Label htmlFor={id} className="text-xs">
            {field.name}
            {field.isRequired && <span className="text-destructive"> *</span>}
          </Label>
          <Select
            value={typeof value === "string" ? value : ""}
            onValueChange={(v) => onChange(v || null)}
          >
            <SelectTrigger id={id} className="h-8 text-sm">
              <SelectValue placeholder={`Select ${field.name}`} />
            </SelectTrigger>
            <SelectContent>
              {!field.isRequired && (
                <SelectItem value="">None</SelectItem>
              )}
              {field.enumOptions.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}

function formatFieldValue(fieldType: CustomFieldType, value: unknown): string {
  if (value === null || value === undefined) return "—";

  switch (fieldType) {
    case "BOOLEAN":
      return value ? "Yes" : "No";
    case "DATE":
      if (typeof value === "string") {
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return String(value);
        }
      }
      return String(value);
    case "NUMBER":
      return typeof value === "number" ? value.toLocaleString() : String(value);
    default:
      return String(value);
  }
}

function formatRawValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return JSON.stringify(value);
}
