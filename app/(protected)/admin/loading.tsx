import { Skeleton } from "@/components/ui/skeleton";
import { DashboardHeader } from "@/components/dashboard/header";

export default function AdminPanelLoading() {
  return (
    <>
      <DashboardHeader
        heading="Admin Panel"
        text="Platform overview and management."
      />
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <Skeleton className="h-[380px] w-full rounded-lg xl:col-span-2" />
          <Skeleton className="h-[380px] w-full rounded-lg" />
        </div>
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    </>
  );
}
