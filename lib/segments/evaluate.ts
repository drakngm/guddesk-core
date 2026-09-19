import type { Prisma } from "@prisma/client";

/**
 * A single condition in a segment filter.
 */
export interface SegmentCondition {
  field: string; // e.g. "name", "email", "metadata.plan", "companyId", "conversationCount", "lastSeenAt", "createdAt"
  operator: string; // "equals", "contains", "gt", "lt", "before", "after", "is_set", "is_not_set"
  value?: string | number | boolean | null;
}

/**
 * Build a Prisma `where` clause from segment conditions.
 *
 * All conditions are AND-ed together. The resulting clause is merged
 * with any base `where` (e.g. workspaceId filter) by the caller.
 *
 * Supported fields:
 * - name, email, externalId — string contains/equals
 * - metadata.* (custom fields) — equals/contains depending on value type
 * - companyId — equals
 * - lastSeenAt, createdAt — before/after date comparisons
 *
 * Conversation count is handled separately via `_count` filtering.
 */
export function buildSegmentWhereClause(
  conditions: SegmentCondition[],
): Prisma.VisitorWhereInput {
  if (conditions.length === 0) return {};

  const andClauses: Prisma.VisitorWhereInput[] = [];

  for (const condition of conditions) {
    const clause = buildSingleCondition(condition);
    if (clause) {
      andClauses.push(clause);
    }
  }

  if (andClauses.length === 0) return {};
  if (andClauses.length === 1) return andClauses[0]!;
  return { AND: andClauses };
}

function buildSingleCondition(
  condition: SegmentCondition,
): Prisma.VisitorWhereInput | null {
  const { field, operator, value } = condition;

  // Handle is_set / is_not_set operators (no value needed)
  if (operator === "is_set") {
    if (field.startsWith("metadata.")) {
      // For metadata fields, check if the key exists and is not null
      const metaKey = field.slice("metadata.".length);
      return {
        metadata: {
          path: [metaKey],
          not: { equals: null as unknown as Prisma.InputJsonValue },
        },
      } as unknown as Prisma.VisitorWhereInput;
    }
    return { [field]: { not: null } };
  }

  if (operator === "is_not_set") {
    if (field.startsWith("metadata.")) {
      return {} as Prisma.VisitorWhereInput; // Hard to express "key missing" in JSON; skip for now
    }
    return { [field]: null };
  }

  // String fields: name, email, externalId
  if (["name", "email", "externalId"].includes(field)) {
    const strVal = String(value ?? "");
    switch (operator) {
      case "equals":
        return { [field]: strVal };
      case "contains":
        return { [field]: { contains: strVal, mode: "insensitive" as const } };
      default:
        return null;
    }
  }

  // Company ID
  if (field === "companyId") {
    switch (operator) {
      case "equals":
        return value ? { companyId: String(value) } : { companyId: null };
      case "is_set":
        return { companyId: { not: null } };
      case "is_not_set":
        return { companyId: null };
      default:
        return null;
    }
  }

  // Date fields: lastSeenAt, createdAt
  if (["lastSeenAt", "createdAt"].includes(field)) {
    const dateVal = new Date(String(value));
    if (isNaN(dateVal.getTime())) return null;

    switch (operator) {
      case "before":
        return { [field]: { lt: dateVal } };
      case "after":
        return { [field]: { gt: dateVal } };
      case "equals":
        // Same day comparison
        const nextDay = new Date(dateVal);
        nextDay.setDate(nextDay.getDate() + 1);
        return { [field]: { gte: dateVal, lt: nextDay } };
      default:
        return null;
    }
  }

  // Conversation count (uses Prisma relation count filtering)
  if (field === "conversationCount") {
    const numVal = Number(value);
    if (isNaN(numVal)) return null;

    switch (operator) {
      case "equals":
        return { conversations: { _count: { equals: numVal } } } as unknown as Prisma.VisitorWhereInput;
      case "gt":
        return { conversations: { some: {} }, _count: { conversations: { gt: numVal } } } as unknown as Prisma.VisitorWhereInput;
      case "lt":
        return { _count: { conversations: { lt: numVal } } } as unknown as Prisma.VisitorWhereInput;
      default:
        return null;
    }
  }

  // Metadata fields: metadata.plan, metadata.mrr, etc.
  if (field.startsWith("metadata.")) {
    const metaKey = field.slice("metadata.".length);
    switch (operator) {
      case "equals":
        return {
          metadata: {
            path: [metaKey],
            equals: value as Prisma.InputJsonValue,
          },
        } as unknown as Prisma.VisitorWhereInput;
      case "contains":
        return {
          metadata: {
            path: [metaKey],
            string_contains: String(value),
          },
        } as unknown as Prisma.VisitorWhereInput;
      case "gt":
        return {
          metadata: {
            path: [metaKey],
            gt: Number(value),
          },
        } as unknown as Prisma.VisitorWhereInput;
      case "lt":
        return {
          metadata: {
            path: [metaKey],
            lt: Number(value),
          },
        } as unknown as Prisma.VisitorWhereInput;
      default:
        return null;
    }
  }

  return null;
}
