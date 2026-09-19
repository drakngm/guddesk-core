import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard/header";

export default function UsersLoading() {
  return (
    <>
      <DashboardHeader heading="Users" text="Manage platform users." />
      <div className="space-y-4">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[140px]" />
        </div>
        <Skeleton className="h-[500px] w-full rounded-lg" />
      </div>
    </>
  );
}
