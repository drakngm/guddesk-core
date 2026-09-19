import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { withApiAuth, withHeaders, apiOk, apiError } from "@/lib/api-utils";

// ---------------------------------------------------------------------------
// GET /api/v1/companies/:companyId  —  Get a company
// Requires: READ_ONLY or higher
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  const result = await withApiAuth(req, { permission: "READ_ONLY" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        domain: true,
        website: true,
        logoUrl: true,
        industry: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        visitors: {
          select: {
            id: true,
            externalId: true,
            name: true,
            email: true,
            avatarUrl: true,
            lastSeenAt: true,
          },
          orderBy: [
            { lastSeenAt: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
          ],
          take: 50,
        },
        _count: { select: { visitors: true } },
      },
    });

    if (!company || company.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Company not found", 404), rateLimitHeaders);
    }

    const { workspaceId: _ws, ...data } = company;
    return withHeaders(apiOk(data), rateLimitHeaders);
  } catch (error) {
    console.error("Get company error:", error);
    return withHeaders(apiError("Failed to get company", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/companies/:companyId  —  Update a company
// Body: { name?, domain?, website?, logoUrl?, industry?, metadata? }
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true },
    });

    if (!existing || existing.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Company not found", 404), rateLimitHeaders);
    }

    const body = await req.json();
    const { name, domain, website, logoUrl, industry, metadata } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = typeof name === "string" ? name.trim() : name;
    if (domain !== undefined) updateData.domain = typeof domain === "string" ? domain.trim().toLowerCase() : null;
    if (website !== undefined) updateData.website = typeof website === "string" ? website.trim() : null;
    if (logoUrl !== undefined) updateData.logoUrl = typeof logoUrl === "string" ? logoUrl.trim() : null;
    if (industry !== undefined) updateData.industry = typeof industry === "string" ? industry.trim() : null;
    if (metadata !== undefined) updateData.metadata = metadata;

    if (Object.keys(updateData).length === 0) {
      return withHeaders(
        apiError("No fields to update. Provide at least one of: name, domain, website, logoUrl, industry, metadata.", 400),
        rateLimitHeaders,
      );
    }

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        domain: true,
        website: true,
        logoUrl: true,
        industry: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return withHeaders(apiOk(updated), rateLimitHeaders);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return withHeaders(
        apiError("A company with this domain already exists in this workspace", 409),
        rateLimitHeaders,
      );
    }
    console.error("Update company error:", error);
    return withHeaders(apiError("Failed to update company", 500), rateLimitHeaders);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/companies/:companyId  —  Delete a company
// Requires: READ_WRITE or higher
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  const result = await withApiAuth(req, { permission: "READ_WRITE" });
  if (!result.ok) return result.response;
  const { ctx, rateLimitHeaders } = result;

  try {
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workspaceId: true },
    });

    if (!existing || existing.workspaceId !== ctx.workspaceId) {
      return withHeaders(apiError("Company not found", 404), rateLimitHeaders);
    }

    // Unlink visitors first, then delete
    await prisma.visitor.updateMany({
      where: { companyId },
      data: { companyId: null },
    });

    await prisma.company.delete({ where: { id: companyId } });

    return withHeaders(apiOk({ deleted: true }), rateLimitHeaders);
  } catch (error) {
    console.error("Delete company error:", error);
    return withHeaders(apiError("Failed to delete company", 500), rateLimitHeaders);
  }
}
