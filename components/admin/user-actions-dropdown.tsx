"use client";

import { useState } from "react";
import { MoreHorizontal, Shield, ShieldOff, Ban, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { banUser } from "@/actions/admin/ban-user";
import { adminUpdateUserRole } from "@/actions/admin/update-user-role";

interface UserActionsDropdownProps {
  userId: string;
  userName: string | null;
  currentRole: "ADMIN" | "USER";
  isBanned: boolean;
  isCurrentUser: boolean;
}

export function UserActionsDropdown({
  userId,
  userName,
  currentRole,
  isBanned,
  isCurrentUser,
}: UserActionsDropdownProps) {
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [loading, setLoading] = useState(false);

  const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";

  async function handleBan() {
    setLoading(true);
    const result = await banUser({ userId, reason: banReason || undefined });
    setLoading(false);

    if (result.status === "success") {
      toast.success(result.banned ? "User banned" : "User unbanned");
      setBanDialogOpen(false);
      setBanReason("");
    } else {
      toast.error(result.message ?? "Failed");
    }
  }

  async function handleRoleChange() {
    setLoading(true);
    const result = await adminUpdateUserRole({ userId, role: newRole });
    setLoading(false);

    if (result.status === "success") {
      toast.success(`Role changed to ${newRole}`);
      setRoleDialogOpen(false);
    } else {
      toast.error(result.message ?? "Failed");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-8 p-0">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => setRoleDialogOpen(true)}
            disabled={isCurrentUser}
          >
            {currentRole === "ADMIN" ? (
              <>
                <ShieldOff className="mr-2 size-4" />
                Demote to User
              </>
            ) : (
              <>
                <Shield className="mr-2 size-4" />
                Promote to Admin
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setBanDialogOpen(true)}
            disabled={isCurrentUser || currentRole === "ADMIN"}
            className={!isBanned ? "text-destructive focus:text-destructive" : ""}
          >
            {isBanned ? (
              <>
                <UserCheck className="mr-2 size-4" />
                Unban User
              </>
            ) : (
              <>
                <Ban className="mr-2 size-4" />
                Ban User
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Ban/Unban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isBanned ? "Unban" : "Ban"} {userName ?? "this user"}?
            </DialogTitle>
            <DialogDescription>
              {isBanned
                ? "This will restore the user's access to the platform."
                : "This will prevent the user from logging in."}
            </DialogDescription>
          </DialogHeader>
          {!isBanned && (
            <Textarea
              placeholder="Reason for ban (optional)"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBanDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={isBanned ? "default" : "destructive"}
              onClick={handleBan}
              disabled={loading}
            >
              {loading ? "Processing..." : isBanned ? "Unban" : "Ban User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change role to {newRole}?
            </DialogTitle>
            <DialogDescription>
              {newRole === "ADMIN"
                ? "This will give the user full platform admin access."
                : "This will remove admin privileges from this user."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleRoleChange} disabled={loading}>
              {loading ? "Processing..." : `Change to ${newRole}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
