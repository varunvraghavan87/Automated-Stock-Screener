"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Key, ExternalLink, Trash2 } from "lucide-react";

interface KiteCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function KiteCredentialsDialog({
  open,
  onOpenChange,
  onSaved,
}: KiteCredentialsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [maskedKey, setMaskedKey] = useState("");

  // Check if user already has credentials when dialog opens
  useEffect(() => {
    if (open) {
      fetch("/api/kite/credentials")
        .then((res) => res.json())
        .then((data) => {
          setHasExisting(data.hasCredentials || false);
          setMaskedKey(data.maskedApiKey || "");
        })
        .catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!apiKey.trim() || !apiSecret.trim()) {
      setError("Both API Key and API Secret are required");
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(apiKey)) {
      setError("API Key must be alphanumeric");
      return;
    }

    if (!/^[a-zA-Z0-9]+$/.test(apiSecret)) {
      setError("API Secret must be alphanumeric");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/kite/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credentials");
      }

      // Clear form and close
      setApiKey("");
      setApiSecret("");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save credentials"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/kite/credentials", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to remove credentials");
      }
      setHasExisting(false);
      setMaskedKey("");
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove credentials"
      );
    } finally {
      setDeleting(false);
    }
  };

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/kite/callback`
      : "/api/kite/callback";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            Kite Connect Setup
          </DialogTitle>
          <DialogDescription>
            Connect your Zerodha Kite account for live market data.
          </DialogDescription>
        </DialogHeader>

        {/* Setup Instructions */}
        <div className="rounded-md bg-muted p-3 text-sm space-y-2">
          <p className="font-medium">Setup steps:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>
              Create a Kite Connect app at{" "}
              <a
                href="https://developers.kite.trade"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline inline-flex items-center gap-1"
              >
                developers.kite.trade
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              Set the <strong>Redirect URL</strong> to:
              <code className="block mt-1 text-xs bg-background px-2 py-1 rounded border break-all">
                {callbackUrl}
              </code>
            </li>
            <li>Copy your API Key and API Secret below</li>
          </ol>
        </div>

        {/* Existing credentials indicator */}
        {hasExisting && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="text-sm">
              <p className="font-medium">Current API Key</p>
              <p className="text-muted-foreground font-mono">{maskedKey}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kite-api-key">API Key</Label>
            <Input
              id="kite-api-key"
              placeholder="Your Kite API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kite-api-secret">API Secret</Label>
            <Input
              id="kite-api-secret"
              type="password"
              placeholder="Your Kite API Secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              autoComplete="off"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {hasExisting ? "Update Credentials" : "Save Credentials"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
