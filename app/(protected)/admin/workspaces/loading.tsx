import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard/header";

export default function WorkspacesLoading() {
  return (
    <>
      <DashboardHeader heading="Workspaces" text="Manage platform workspaces." />
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-[140px]" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    </>
  );
}
