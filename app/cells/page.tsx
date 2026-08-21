import { redirect } from "next/navigation";

// Delightful Cells moved to the homepage; keep old links working.
export default function CellsPage() {
  redirect("/");
}
