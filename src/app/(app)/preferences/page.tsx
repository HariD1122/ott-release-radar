import { redirect } from "next/navigation";

// Preferences now live on the Profile page.
export default function Preferences() {
  redirect("/profile");
}
