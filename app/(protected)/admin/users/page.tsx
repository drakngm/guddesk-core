import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { getUsersList } from "@/lib/admin";
import { constructMetadata } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard/header";
import { UsersTable } from "@/components/admin/users-table";

export const metadata = constructMetadata({
  title: "Users – Admin – GudDesk",
  description: "Manage platform users.",
});

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    role?: string;
    status?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  const user = await getCurrentUser();
  if (!user?.id || user.role !== "ADMIN") redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const search = params.search || undefined;
  const roleFilter = params.role === "ADMIN" || params.role === "USER" ? params.role : undefined;
  const statusFilter = params.status === "active" || params.status === "banned" ? params.status : undefined;

  const data = await getUsersList(page, 20, search, {
    role: roleFilter,
    status: statusFilter,
  });

  return (
    <>
      <DashboardHeader heading="Users" text="Manage platform users." />
      <UsersTable
        users={data.users}
        total={data.total}
        totalPages={data.totalPages}
        page={data.page}
        currentUserId={user.id}
      />
    </>
  );
}
