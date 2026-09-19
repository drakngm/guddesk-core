"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Eye, Crown, ArrowDown, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { changeWorkspacePlan } from "@/actions/admin/change-workspace-plan";
import { deleteWorkspace } from "@/actions/admin/delete-workspace";

interface WorkspaceActionsDropdownProps {
  workspaceId: string;
  workspaceName: string;
  currentPlan: "FREE" | "PRO";
}

export function WorkspaceActionsDropdown({
  workspaceId,
  workspaceName,
  currentPlan,
}: WorkspaceActionsDropdownProps) {
  const router = useRouter();
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [loading, setLoading] = useState(false);

  const newPlan = currentPlan === "PRO" ? "FREE" : "PRO";

  async function handlePlanChange() {
    setLoading(true);
    const result = await changeWorkspacePlan({ workspaceId, plan: newPlan });
    setLoading(false);

    if (result.status === "success") {
      toast.success(`Plan changed to ${newPlan}`);
      setPlanDialogOpen(false);
    } else {
      toast.error(result.message ?? "Failed");
    }
  }

  async function handleDelete() {
    setLoading(true);
    const result = await deleteWorkspace({ workspaceId, confirmName });
    setLoading(false);

    if (result.status === "success") {
      toast.success("Workspace deleted");
      setDeleteDialogOpen(false);
      setConfirmName("");
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
          <DropdownMenuItem onClick={() => router.push(`/admin/workspaces/${workspaceId}`)}>
            <Eye className="mr-2 size-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPlanDialogOpen(true)}>
            {currentPlan === "FREE" ? (
              <>
                <Crown className="mr-2 size-4" />
                Gift Pro Plan
              </>
            ) : (
              <>
                <ArrowDown className="mr-2 size-4" />
                Downgrade to Free
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Plan Change Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {newPlan === "PRO" ? "Gift Pro Plan" : "Downgrade to Free"}
            </DialogTitle>
            <DialogDescription>
              {newPlan === "PRO"
                ? `This will upgrade "${workspaceName}" to the Pro plan without requiring payment.`
                : `This will downgrade "${workspaceName}" to the Free plan. AI features and higher limits will be removed.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPlanDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={newPlan === "PRO" ? "default" : "destructive"}
              onClick={handlePlanChange}
              disabled={loading}
            >
              {loading ? "Processing..." : `Change to ${newPlan}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workspace?</DialogTitle>
            <DialogDescription>
              This will permanently delete &quot;{workspaceName}&quot; and all its
              data including conversations, articles, and members. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Type &quot;{workspaceName}&quot; to confirm:
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={workspaceName}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setConfirmName("");
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading || confirmName !== workspaceName}
            >
              {loading ? "Deleting..." : "Delete Workspace"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
