import { redirect } from "next/navigation";

// Billing has moved to the account level
export default function WorkspaceBillingPage() {
  redirect("/dashboard/billing");
}
