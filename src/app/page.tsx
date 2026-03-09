import { redirect } from "next/navigation";

/** Root page that redirects to the login screen. */
export default function Home() {
  redirect("/login");
}
