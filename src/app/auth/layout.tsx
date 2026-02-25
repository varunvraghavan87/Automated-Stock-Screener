import { Activity } from "lucide-react";
import { SupabaseHealthCheck } from "@/components/supabase-health-check";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="flex items-center gap-2 mb-8">
        <Activity className="w-8 h-8 text-primary" />
        <span className="font-bold text-2xl">
          Nifty Velocity <span className="text-primary">Alpha</span>
        </span>
      </div>
      <SupabaseHealthCheck />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
