import PendingXpmNotice from "@/components/dashboard/PendingXpmNotice";

export default function RevenueSnapshot() {
  return (
    <PendingXpmNotice
      title="💰 YTD revenue — top clients"
      note="needs XPM invoice data to compute YTD revenue per client against FY targets."
    />
  );
}
