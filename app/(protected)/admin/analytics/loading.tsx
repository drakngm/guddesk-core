import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard/header";

export default function AnalyticsLoading() {
  return (
    <>
      <DashboardHeader heading="Platform Analytics" text="Loading..." />
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Skeleton className="h-[380px] w-full rounded-lg" />
          <Skeleton className="h-[380px] w-full rounded-lg" />
        </div>
        <Skeleton className="h-[380px] w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    </>
  );
}
