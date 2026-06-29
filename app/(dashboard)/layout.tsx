
import TopNav from "@/components/layout/TopNav";

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div style={{ minHeight: "100vh", background: "#f5f4f0" }}>
			<TopNav />
			<main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.5rem 1rem" }}>
				{children}
			</main>
		</div>
	);
}
