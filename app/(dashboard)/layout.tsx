import TopNav from "@/components/layout/TopNav";
import { auth } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userName = session?.user?.name ?? null;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0" }}>
      <TopNav userName={userName} />
      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.5rem 1rem" }}>
        {children}
      </main>
    </div>
  );
}
