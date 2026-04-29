import { redirect } from "next/navigation";

/** /elements is a soft redirect to /elements/library to preserve old bookmarks. */
export default function ElementsIndexPage() {
  redirect("/elements/library");
}
