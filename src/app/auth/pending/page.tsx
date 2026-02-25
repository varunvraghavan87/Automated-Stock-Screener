"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, XCircle, RefreshCw, LogOut, Loader2 } from "lucide-react";

export default function PendingPage() {
  return (
    <Suspense>
      <PendingContent />
    </Suspense>
  );
}

function PendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signOut } = useAuth();

  const isRejected = searchParams.get("status") === "rejected";
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isRejected) {
      // Fetch rejection reason from our own API (bypasses ISP DNS blocking)
      fetch("/api/auth/profile", { credentials: "same-origin" })
        .then((res) => res.json())
        .then((data) => {
          if (data.rejectionReason) {
            setRejectionReason(data.rejectionReason);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch rejection reason:", err);
        });
    }
  }, [isRejected]);

  const handleCheckStatus = () => {
    setChecking(true);
    // Navigate to home — middleware will re-evaluate approval status
    // and either let them through or redirect back here
    router.push("/");
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth/login");
    router.refresh();
  };

  if (isRejected) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6 text-center space-y-4">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">Account Not Approved</h2>
          <p className="text-muted-foreground text-sm">
            Your account registration was not approved by an administrator.
          </p>
          {rejectionReason && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <p className="font-medium mb-1">Reason:</p>
              <p>{rejectionReason}</p>
            </div>
          )}
          <Button variant="outline" onClick={handleSignOut} className="mt-4">
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="pt-6 text-center space-y-4">
        <Clock className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-semibold">Account Pending Approval</h2>
        <p className="text-muted-foreground text-sm">
          Your account has been created and is awaiting administrator approval.
          You&apos;ll be able to access the app once approved.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={handleCheckStatus}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Check Status
          </Button>
          <Button variant="ghost" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
