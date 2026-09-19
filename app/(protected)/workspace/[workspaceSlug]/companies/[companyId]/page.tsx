import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/shared/icons";
import { CompanyDetail } from "@/components/companies/company-detail";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; companyId: string }>;
}) {
  const { workspaceSlug, companyId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  await requireWorkspaceMember(workspace.id, user.id!);

  const [company, customFields] = await Promise.all([
    prisma.company.findUnique({
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
            name: true,
            email: true,
            avatarUrl: true,
            lastSeenAt: true,
            _count: { select: { conversations: true } },
          },
          orderBy: [
            { lastSeenAt: { sort: "desc", nulls: "last" } },
            { createdAt: "desc" },
          ],
          take: 50,
        },
        _count: { select: { visitors: true } },
      },
    }),
    prisma.customField.findMany({
      where: { workspaceId: workspace.id, entityType: "company" },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  if (!company || company.workspaceId !== workspace.id) {
    notFound();
  }

  const { workspaceId: _ws, ...companyData } = company;

  return (
    <>
      <DashboardHeader heading={company.name} text="Company profile">
        <Link href={`/workspace/${workspaceSlug}/companies`}>
          <Button variant="outline" size="sm">
            <Icons.chevronLeft className="mr-1 size-4" />
            Back to Companies
          </Button>
        </Link>
      </DashboardHeader>

      <CompanyDetail
        company={companyData}
        workspaceId={workspace.id}
        workspaceSlug={workspaceSlug}
        customFields={customFields}
      />
    </>
  );
}
