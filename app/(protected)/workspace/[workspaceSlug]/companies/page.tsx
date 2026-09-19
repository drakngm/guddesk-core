import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { CompaniesList } from "@/components/companies/companies-list";

const PAGE_SIZE = 25;

interface CompaniesPageProps {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function CompaniesPage({
  params,
  searchParams,
}: CompaniesPageProps) {
  const { workspaceSlug } = await params;
  const query = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  await requireWorkspaceMember(workspace.id, user.id!);

  const page = Math.max(1, parseInt(query.page ?? "1", 10) || 1);
  const search = query.search?.trim() || undefined;

  // Build where clause
  const where: Prisma.CompanyWhereInput = { workspaceId: workspace.id };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { domain: { contains: search, mode: "insensitive" } },
      { industry: { contains: search, mode: "insensitive" } },
    ];
  }

  const [companies, total] = await Promise.all([
    prisma.company.findMany({
      where,
      select: {
        id: true,
        name: true,
        domain: true,
        logoUrl: true,
        industry: true,
        createdAt: true,
        _count: { select: { visitors: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.company.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <DashboardHeader
        heading="Companies"
        text="Manage organizations and group customers by company."
      />

      <CompaniesList
        companies={companies}
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        total={total}
        totalPages={totalPages}
        page={page}
      />
    </>
  );
}
