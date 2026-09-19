import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { canUserCreateWorkspace } from "@/lib/feature-flags";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateWorkspaceForm } from "@/components/workspace/create-workspace-form";

export default async function CreateWorkspacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { allowed } = await canUserCreateWorkspace(user.id!);

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your workspace</CardTitle>
          <CardDescription>
            Set up your workspace to start receiving customer messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWorkspaceForm canCreate={allowed} />
        </CardContent>
      </Card>
    </div>
  );
}
