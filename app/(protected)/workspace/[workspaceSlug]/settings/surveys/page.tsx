import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getWorkspaceBySlug, requireWorkspaceMember } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { DashboardHeader } from "@/components/dashboard/header";
import { SurveyConfigEditor } from "@/components/settings/survey-config-editor";

export default async function SurveysSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspaceBySlug(workspaceSlug);
  if (!workspace) redirect("/dashboard");

  await requireWorkspaceMember(workspace.id, user.id!);

  const configs = await prisma.surveyConfig.findMany({
    where: { workspaceId: workspace.id },
  });

  const csatConfig = configs.find((c) => c.type === "CSAT") ?? null;
  const npsConfig = configs.find((c) => c.type === "NPS") ?? null;

  return (
    <>
      <DashboardHeader
        heading="Surveys"
        text="Configure CSAT and NPS surveys to collect customer feedback."
      />

      <SurveyConfigEditor
        csatConfig={csatConfig}
        npsConfig={npsConfig}
        workspaceId={workspace.id}
      />
    </>
  );
}
