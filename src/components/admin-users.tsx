import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { friendlyError } from "@/lib/friendly-errors";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { listAllUsers, setUserPassword, type AdminUser } from "@/lib/admin-users.functions";

/** Admin-only: list every account and reset passwords. */
export function AdminUsersPanel() {
  const { data: profile } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const fetchUsers = useServerFn(listAllUsers);
  const resetPassword = useServerFn(setUserPassword);

  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [password, setPassword] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

  const users = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.fullName ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  const save = useMutation({
    mutationFn: () => resetPassword({ data: { userId: target!.id, password } }),
    onSuccess: () => {
      toast.success("Saved.");
      setTarget(null);
      setPassword("");
    },
    onError: (e: Error) => toast.error(friendlyError(e)),
  });

  if (!isAdmin) return null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 type-card">
          <Users className="size-4 text-primary" /> Users
        </h2>
        <span className="type-meta text-muted-foreground">{data?.length ?? 0} accounts</span>
      </div>
      <p className="mt-1 type-meta text-muted-foreground">
        Admin only. Reset a password for any account.
      </p>

      <Input
        className="mt-3"
        placeholder="Search name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="mt-3 divide-y divide-border rounded-lg border border-border">
        {isLoading ? (
          <p className="p-3 type-meta text-muted-foreground">Loading accounts…</p>
        ) : error ? (
          <p className="p-3 type-meta text-destructive">{friendlyError(error)}</p>
        ) : users.length === 0 ? (
          <p className="p-3 type-meta text-muted-foreground">
            Nothing here yet. Accounts matching your search will appear here.
          </p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate type-body font-medium">{u.fullName || u.email}</p>
                <p className="truncate type-meta text-muted-foreground">{u.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => {
                  setTarget(u);
                  setPassword("");
                }}
              >
                <KeyRound className="size-4" /> Reset
              </Button>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
            <DialogDescription>{target?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || password.length < 8}>
              Update password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
