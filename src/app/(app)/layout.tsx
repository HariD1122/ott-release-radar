import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import { requireUser } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <Nav name={user.displayName} />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      <Footer />
    </>
  );
}
