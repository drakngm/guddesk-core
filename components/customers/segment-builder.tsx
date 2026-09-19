"use client";

import type { CustomFieldType } from "@prisma/client";

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

export type SegmentCondition = {
  field: string;
  operator: string;
  value?: string | number | boolean | null;
};

type CustomFieldOption = {
  id: string;
  name: string;
  key: string;
  fieldType: CustomFieldType;
  enumOptions: string[];
};

interface SegmentBuilderProps {
  conditions: SegmentCondition[];
  onChange: (conditions: SegmentCondition[]) => void;
  customFields: CustomFieldOption[];
}

// Built-in fields available for segmentation
const builtInFields = [
  { value: "name", label: "Name", operators: ["contains", "equals", "is_set", "is_not_set"] },
  { value: "email", label: "Email", operators: ["contains", "equals", "is_set", "is_not_set"] },
  { value: "externalId", label: "External ID", operators: ["equals", "is_set", "is_not_set"] },
  { value: "companyId", label: "Company", operators: ["equals", "is_set", "is_not_set"] },
  { value: "lastSeenAt", label: "Last Seen", operators: ["before", "after"] },
  { value: "createdAt", label: "Created At", operators: ["before", "after"] },
];

const operatorLabels: Record<string, string> = {
  equals: "equals",
  contains: "contains",
  gt: "greater than",
  lt: "less than",
  before: "before",
  after: "after",
  is_set: "is set",
  is_not_set: "is not set",
};

export function SegmentBuilder({
  conditions,
  onChange,
  customFields,
}: SegmentBuilderProps) {
  // Build field options including custom metadata fields
  const allFields = [
    ...builtInFields,
    ...customFields.map((cf) => ({
      value: `metadata.${cf.key}`,
      label: cf.name,
      operators: getOperatorsForType(cf.fieldType),
      enumOptions: cf.enumOptions,
      fieldType: cf.fieldType,
    })),
  ];

  function addCondition() {
    onChange([...conditions, { field: "email", operator: "contains", value: "" }]);
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<SegmentCondition>) {
    onChange(
      conditions.map((c, i) => {
        if (i !== index) return c;
        const updated = { ...c, ...updates };
        // Reset value when changing to is_set/is_not_set
        if (
          updates.operator === "is_set" ||
          updates.operator === "is_not_set"
        ) {
          updated.value = null;
        }
        return updated;
      }),
    );
  }

  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => {
        const fieldDef = allFields.find((f) => f.value === condition.field);
        const operators = fieldDef?.operators ?? ["equals", "contains"];
        const needsValue =
          condition.operator !== "is_set" &&
          condition.operator !== "is_not_set";
        const isEnumField =
          "fieldType" in (fieldDef ?? {}) &&
          (fieldDef as { fieldType?: string })?.fieldType === "ENUM";
        const enumOptions =
          "enumOptions" in (fieldDef ?? {})
            ? (fieldDef as { enumOptions?: string[] })?.enumOptions ?? []
            : [];

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground w-8 text-center">
                AND
              </span>
            )}
            {index === 0 && <span className="w-8 shrink-0" />}

            {/* Field selector */}
            <Select
              value={condition.field}
              onValueChange={(v) =>
                updateCondition(index, {
                  field: v,
                  operator: allFields.find((f) => f.value === v)?.operators[0] ?? "equals",
                  value: "",
                })
              }
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allFields.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Operator selector */}
            <Select
              value={condition.operator}
              onValueChange={(v) => updateCondition(index, { operator: v })}
            >
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op} value={op}>
                    {operatorLabels[op] ?? op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Value input */}
            {needsValue && (
              <>
                {isEnumField && enumOptions.length > 0 ? (
                  <Select
                    value={String(condition.value ?? "")}
                    onValueChange={(v) =>
                      updateCondition(index, { value: v })
                    }
                  >
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {enumOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : condition.field === "lastSeenAt" ||
                  condition.field === "createdAt" ? (
                  <Input
                    type="date"
                    value={String(condition.value ?? "")}
                    onChange={(e) =>
                      updateCondition(index, { value: e.target.value })
                    }
                    className="h-8 flex-1 text-xs"
                  />
                ) : (
                  <Input
                    value={String(condition.value ?? "")}
                    onChange={(e) =>
                      updateCondition(index, { value: e.target.value })
                    }
                    placeholder="value"
                    className="h-8 flex-1 text-xs"
                  />
                )}
              </>
            )}

            {/* Remove button */}
            <Button
              variant="ghost"
              size="sm"
              className="size-8 p-0 shrink-0"
              onClick={() => removeCondition(index)}
              disabled={conditions.length <= 1}
            >
              <Icons.close className="size-3" />
            </Button>
          </div>
        );
      })}

      <Button
        variant="outline"
        size="sm"
        onClick={addCondition}
        className="mt-2 text-xs"
      >
        <Icons.add className="mr-1 size-3" />
        Add Condition
      </Button>
    </div>
  );
}

function getOperatorsForType(fieldType: CustomFieldType): string[] {
  switch (fieldType) {
    case "TEXT":
      return ["equals", "contains", "is_set", "is_not_set"];
    case "NUMBER":
      return ["equals", "gt", "lt", "is_set", "is_not_set"];
    case "BOOLEAN":
      return ["equals", "is_set", "is_not_set"];
    case "DATE":
      return ["before", "after", "is_set", "is_not_set"];
    case "ENUM":
      return ["equals", "is_set", "is_not_set"];
    default:
      return ["equals", "contains"];
  }
}
