"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Shield,
  Check,
  X,
  Loader2,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  KeyRound,
} from "lucide-react";

interface UserProfile {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: string;
  approvalStatus: string;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}

type FilterStatus = "all" | "pending" | "approved" | "rejected";

export default function AdminPage() {
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Client-side admin guard (defense-in-depth; middleware already blocks)
  useEffect(() => {
    if (!authLoading && role !== "admin") {
      router.push("/");
    }
  }, [authLoading, role, router]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setError("");
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        throw new Error("Failed to fetch users");
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      setError("Failed to load users. Please try again.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (role === "admin") {
      fetchUsers();
    }
  }, [role, fetchUsers]);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to approve");
      }
      await fetchUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve user"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reject");
      }
      setRejectingUserId(null);
      setRejectReason("");
      await fetchUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reject user"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (userId: string, displayName: string) => {
    const newPassword = window.prompt(
      `Enter a new password for ${displayName}.\n\nRequirements:\n• At least 8 characters\n• At least 1 uppercase letter\n• At least 1 number`
    );
    if (!newPassword) return;

    // Client-side validation
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter.");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one number.");
      return;
    }

    setActionLoading(userId);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }
      setSuccessMsg(`Password reset successfully for ${displayName}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password"
      );
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter((u) =>
    filter === "all" ? true : u.approvalStatus === filter
  );

  const counts = {
    all: users.length,
    pending: users.filter((u) => u.approvalStatus === "pending").length,
    approved: users.filter((u) => u.approvalStatus === "approved").length,
    rejected: users.filter((u) => u.approvalStatus === "rejected").length,
  };

  if (authLoading || role !== "admin") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">User Management</h1>
            <p className="text-sm text-muted-foreground">
              Approve or reject user registrations
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-sm text-emerald-600 dark:text-emerald-400">
            {successMsg}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          {(
            [
              { key: "all", label: "All", icon: Users },
              { key: "pending", label: "Pending", icon: Clock },
              { key: "approved", label: "Approved", icon: CheckCircle2 },
              { key: "rejected", label: "Rejected", icon: XCircle },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(key)}
              className="gap-2"
            >
              <Icon className="w-4 h-4" />
              {label}
              <Badge
                variant="secondary"
                className="ml-1 text-[10px] px-1.5 py-0"
              >
                {counts[key]}
              </Badge>
            </Button>
          ))}
        </div>

        {/* User List */}
        {loadingUsers ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              No {filter === "all" ? "" : filter} users found.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((u) => (
              <Card
                key={u.id}
                className={`border-border/50 bg-card/50 ${
                  u.approvalStatus === "pending"
                    ? "border-amber-500/30"
                    : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {u.displayName || "Unknown"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {u.email}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.role === "admin" && (
                        <Badge className="bg-primary/15 text-primary border-primary/30">
                          Admin
                        </Badge>
                      )}
                      <StatusBadge status={u.approvalStatus} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Registered{" "}
                      {new Date(u.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {u.rejectionReason && (
                        <span className="ml-2 text-destructive">
                          Reason: {u.rejectionReason}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      {u.approvalStatus !== "approved" &&
                        u.role !== "admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                            onClick={() => handleApprove(u.userId)}
                            disabled={actionLoading === u.userId}
                          >
                            {actionLoading === u.userId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4 mr-1" />
                            )}
                            Approve
                          </Button>
                        )}
                      {u.approvalStatus !== "rejected" &&
                        u.role !== "admin" && (
                          <>
                            {rejectingUserId === u.userId ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Reason (optional)"
                                  value={rejectReason}
                                  onChange={(e) =>
                                    setRejectReason(e.target.value)
                                  }
                                  className="h-8 w-48 text-xs"
                                />
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleReject(u.userId)}
                                  disabled={actionLoading === u.userId}
                                >
                                  {actionLoading === u.userId ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Confirm"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setRejectingUserId(null);
                                    setRejectReason("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => setRejectingUserId(u.userId)}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            )}
                          </>
                        )}
                      {u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-500 border-blue-500/30 hover:bg-blue-500/10"
                          onClick={() =>
                            handleResetPassword(
                              u.userId,
                              u.displayName || u.email
                            )
                          }
                          disabled={actionLoading === u.userId}
                        >
                          {actionLoading === u.userId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <KeyRound className="w-4 h-4 mr-1" />
                          )}
                          Reset Password
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
          Approved
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/40">
          Rejected
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40">
          Pending
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}
