import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { AccountCostSummary } from "@/components/account-cost-summary";
import { FilterableDataTable } from "@/components/core/filterable-data-table";
import { friendlyError } from "@/lib/friendly-errors";
import { DataFreshness } from "@/components/data-freshness";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  EmptyState,
  LockScreen,
  PageTitle,
  PageToolbar,
  SectionTitle,
  StatCard,
} from "@/components/ui-kit";
import { useProfile } from "@/hooks/use-profile";
import { isAdminEmail } from "@/lib/access";
import { getApiUsage } from "@/lib/api-usage.functions";
import {
  bulkLoginXAccounts,
  deleteXAccount,
  dismissPendingLogin,
  listPendingLogins,
  listXAccounts,
  saveXAccount,
  submitLoginCode,
  syncAccountHandles,
} from "@/lib/publish.functions";

export const Route = createFileRoute("/_authenticated/admin/accounts")({
  head: () => ({
    meta: [
      { title: "Manage Account Connections - CommsIQ" },
      {
        name: "description",
        content: "Import, reconnect and maintain authorised X account sessions.",
      },
    ],
  }),
  component: AdminAccountsPage,
});

type ParsedAccount = {
  handle: string;
  email: string;
  password: string;
  proxy: string;
  totpSecret: string;
  personaLabel: string;
  authToken: string;
};

type UploadResult = {
  handle: string;
  ok: boolean;
  needsCode?: boolean;
  error?: string;
};

const EMPTY_ROW: ParsedAccount = {
  handle: "",
  email: "",
  password: "",
  proxy: "",
  totpSecret: "",
  personaLabel: "",
  authToken: "",
};

const HEADER_KEYS: Record<string, keyof ParsedAccount> = {
  handle: "handle",
  username: "handle",
  user: "handle",
  email: "email",
  password: "password",
  pass: "password",
  proxy: "proxy",
  totp: "totpSecret",
  totp_secret: "totpSecret",
  "2fa": "totpSecret",
  "2fa_secret": "totpSecret",
  persona: "personaLabel",
  persona_label: "personaLabel",
  label: "personaLabel",
  auth_token: "authToken",
  authtoken: "authToken",
  token: "authToken",
};

/** Validate/normalise an X TOTP secret before it reaches the login endpoint. */
export function checkTotpSecret(rawSecret: string): { value: string; problem: string | null } {
  const trimmed = rawSecret.trim();
  if (!trimmed) return { value: "", problem: null };

  let candidate = trimmed;
  const match = /^otpauth:\/\//i.test(candidate) ? candidate.match(/[?&]secret=([^&]+)/i) : null;
  if (match?.[1]) candidate = decodeURIComponent(match[1]);

  const normalized = candidate.replace(/[\s-]/g, "").toUpperCase().replace(/=+$/, "");
  if (/^\d+$/.test(normalized))
    return { value: "", problem: "looks like a one-time code, not the 2FA secret" };
  if (!/^[A-Z2-7]+$/.test(normalized))
    return { value: "", problem: "is not a valid base32 2FA secret" };
  if (normalized.length < 16) return { value: "", problem: "is shorter than a normal 2FA secret" };
  return { value: normalized, problem: null };
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === "," || char === ";" || char === "\t") {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

function parseUpload(text: string): { rows: ParsedAccount[]; warnings: string[] } {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { rows: [], warnings: [] };

  const parsed = lines.map(splitCsvLine);
  const first = parsed[0] ?? [];
  const normalizedHeaders = first.map((value) => value.toLowerCase().replace(/[\s-]+/g, "_"));
  const headerMatches = normalizedHeaders.filter((value) => HEADER_KEYS[value]).length;
  const hasHeader = headerMatches >= 2;
  const order: (keyof ParsedAccount | null)[] = hasHeader
    ? normalizedHeaders.map((value) => HEADER_KEYS[value] ?? null)
    : ["handle", "email", "password", "proxy", "totpSecret", "personaLabel", "authToken"];

  const rows: ParsedAccount[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const values of parsed.slice(hasHeader ? 1 : 0)) {
    const row: ParsedAccount = { ...EMPTY_ROW };
    values.forEach((value, index) => {
      const key = order[index];
      if (key) row[key] = value;
    });
    row.handle = row.handle.replace(/^@/, "").replace(/\s+/g, "");
    if (!row.handle) continue;
    if (!row.authToken && !row.password) {
      warnings.push(`@${row.handle}: no password or auth token supplied`);
      continue;
    }
    const lower = row.handle.toLowerCase();
    if (seen.has(lower)) {
      warnings.push(`@${row.handle}: duplicate row ignored`);
      continue;
    }
    seen.add(lower);

    if (row.totpSecret) {
      const checked = checkTotpSecret(row.totpSecret);
      if (checked.problem)
        warnings.push(`@${row.handle}: ${checked.problem}; login may require a one-time code`);
      row.totpSecret = checked.value;
    }
    rows.push(row);
  }

  return { rows, warnings };
}

function relativeTime(iso: string | null) {
  if (!iso) return "No activity yet";
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "No activity yet";
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function AdminAccountsPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const isAdmin = isAdminEmail(profile?.email);
  const queryClient = useQueryClient();
  const fetchAccounts = useServerFn(listXAccounts);
  const fetchPending = useServerFn(listPendingLogins);
  const fetchUsage = useServerFn(getApiUsage);
  const bulkLogin = useServerFn(bulkLoginXAccounts);
  const saveAccount = useServerFn(saveXAccount);
  const submitCode = useServerFn(submitLoginCode);
  const dismissPending = useServerFn(dismissPendingLogin);
  const removeAccount = useServerFn(deleteXAccount);
  const syncHandles = useServerFn(syncAccountHandles);
  const fileRef = useRef<HTMLInputElement>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [lastUpload, setLastUpload] = useState<{
    results: UploadResult[];
    warnings: string[];
  } | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["x-accounts", "all"],
    queryFn: () => fetchAccounts({ data: { scope: "all" } }),
    enabled: isAdmin,
  });
  const pendingQuery = useQuery({
    queryKey: ["x-pending-logins"],
    queryFn: () => fetchPending(),
    enabled: isAdmin,
  });
  const usageQuery = useQuery({
    queryKey: ["api-usage"],
    queryFn: () => fetchUsage(),
    enabled: isAdmin,
    refetchInterval: 5 * 60 * 1000,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 2_000_000) throw new Error("File is larger than 2MB.");
      const parsed = parseUpload(await file.text());
      if (!parsed.rows.length) throw new Error("No usable accounts were found in that file.");
      const results: UploadResult[] = [];

      for (const row of parsed.rows.filter((item) => item.authToken)) {
        try {
          await saveAccount({
            data: {
              handle: row.handle,
              displayName: "",
              personaLabel: row.personaLabel,
              authToken: row.authToken,
            },
          });
          results.push({ handle: row.handle, ok: true });
        } catch (error) {
          results.push({
            handle: row.handle,
            ok: false,
            error: error instanceof Error ? error.message : "Could not save account",
          });
        }
      }

      const passwordRows = parsed.rows.filter((item) => !item.authToken && item.password);
      for (let index = 0; index < passwordRows.length; index += 50) {
        const batch = passwordRows.slice(index, index + 50);
        const response = await bulkLogin({
          data: {
            defaultProxy: "",
            accounts: batch.map((row) => ({
              handle: row.handle,
              email: row.email,
              password: row.password,
              proxy: row.proxy,
              totpSecret: row.totpSecret,
              personaLabel: row.personaLabel,
            })),
          },
        });
        results.push(...response.results);
      }

      return { results, warnings: parsed.warnings };
    },
    onSuccess: async (result) => {
      setLastUpload(result);
      const ok = result.results.filter((item) => item.ok).length;
      const pending = result.results.filter((item) => item.needsCode).length;
      toast.success(
        `${ok} account${ok === 1 ? "" : "s"} connected${pending ? ` · ${pending} need a verification code` : ""}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["x-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["x-pending-logins"] }),
      ]);
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const verify = useMutation({
    mutationFn: (input: { id: string; code: string }) => submitCode({ data: input }),
    onSuccess: async (result, input) => {
      if (!result.ok) {
        toast.error(
          result.error ? friendlyError(result.error) : "That verification code was not accepted.",
        );
        return;
      }
      setCodes((current) => ({ ...current, [input.id]: "" }));
      toast.success("Account connected.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["x-accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["x-pending-logins"] }),
      ]);
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissPending({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["x-pending-logins"] }),
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeAccount({ data: { id } }),
    onSuccess: async () => {
      toast.success("Account removed from the workspace.");
      await queryClient.invalidateQueries({ queryKey: ["x-accounts"] });
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const sync = useMutation({
    mutationFn: () => syncHandles(),
    onSuccess: async (result) => {
      toast.success(
        `${result.checked} checked · ${result.renamed} username updates · ${result.suspended} suspended.`,
      );
      await queryClient.invalidateQueries({ queryKey: ["x-accounts"] });
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const accounts = accountsQuery.data ?? [];
  const ready = accounts.filter(
    (account) => account.isActive && account.hasToken && !account.suspended,
  ).length;
  const suspended = accounts.filter((account) => account.suspended).length;
  const attention = accounts.length - ready - suspended;

  if (!profileLoading && !isAdmin) {
    return (
      <WorkspaceShell title="Manage connections">
        <LockScreen title="You don't have access to this yet." />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title="Manage connections" wide>
      <PageTitle
        description="Advanced account maintenance for importing, reconnecting, verifying and removing authorised X accounts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/linked-accounts">Back to Linked Accounts</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}{" "}
              Sync X status
            </Button>
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}{" "}
              Import accounts
            </Button>
          </div>
        }
      >
        Manage connections
      </PageTitle>

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload.mutate(file);
        }}
      />

      <Card className="mb-5 border-primary/20 bg-primary/[0.025]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="type-body font-semibold">Credentials stay server-side</p>
            <p className="mt-1 type-meta text-muted-foreground">
              Import files may contain account login material, but this page never renders stored
              passwords, tokens or proxies back to the browser after connection.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ready" value={ready} icon={CheckCircle2} tone="positive" />
        <StatCard
          label="Needs attention"
          value={attention}
          icon={AlertTriangle}
          tone={attention ? "negative" : "neutral"}
        />
        <StatCard
          label="Suspended"
          value={suspended}
          icon={AlertTriangle}
          tone={suspended ? "negative" : "neutral"}
        />
      </div>

      <div className="mt-5">
        <AccountCostSummary
          credits={usageQuery.data?.credits.credits ?? null}
          loading={usageQuery.isLoading}
          configured={usageQuery.data?.credits.configured ?? false}
        />
      </div>

      {(pendingQuery.data?.length ?? 0) > 0 ? (
        <Card className="mb-5">
          <SectionTitle>Verification required</SectionTitle>
          <p className="mt-1 type-meta text-muted-foreground">
            Complete X verification for the accounts that were challenged during import.
          </p>
          <ul className="mt-4 divide-y divide-border">
            {(pendingQuery.data ?? []).map((pending) => (
              <li
                key={pending.id}
                className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="type-body font-semibold">@{pending.handle}</p>
                  <p className="type-meta text-muted-foreground">
                    {pending.error || "X requested a verification code."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={codes[pending.id] ?? ""}
                    onChange={(event) =>
                      setCodes((current) => ({
                        ...current,
                        [pending.id]: event.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="Code"
                    aria-label={`Verification code for @${pending.handle}`}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-28"
                  />
                  <Button
                    size="sm"
                    disabled={verify.isPending || (codes[pending.id] ?? "").length < 4}
                    onClick={() => verify.mutate({ id: pending.id, code: codes[pending.id] ?? "" })}
                  >
                    Verify
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => dismiss.mutate(pending.id)}
                    aria-label={`Dismiss verification for ${pending.handle}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {lastUpload ? (
        <Card className="mb-5">
          <div className="flex items-center gap-2">
            <FileUp className="size-4 text-primary" />
            <SectionTitle>Last import</SectionTitle>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 type-meta">
            <span className="rounded-full bg-positive/10 px-2 py-1 text-positive">
              {lastUpload.results.filter((item) => item.ok).length} connected
            </span>
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
              {lastUpload.results.filter((item) => item.needsCode).length} verification
            </span>
            <span className="rounded-full bg-destructive/10 px-2 py-1 text-destructive">
              {lastUpload.results.filter((item) => !item.ok && !item.needsCode).length} failed
            </span>
          </div>
          {lastUpload.warnings.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer type-meta font-semibold">
                Import warnings ({lastUpload.warnings.length})
              </summary>
              <ul className="mt-2 space-y-1 type-meta text-muted-foreground">
                {lastUpload.warnings.slice(0, 20).map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}

      <PageToolbar>
        <div className="type-meta text-muted-foreground sm:ml-auto">
          <DataFreshness
            at={accounts[0]?.handleSyncedAt ?? accounts[0]?.lastActivityAt}
            label="Accounts"
            staleMinutes={1440}
          />
        </div>
      </PageToolbar>

      <div className="mt-4">
        {accountsQuery.isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !accounts.length ? (
          <EmptyState
            title="Nothing here yet."
            description="Nothing here yet. Import a CSV or text file to connect authorised X accounts."
          />
        ) : (
          <FilterableDataTable
            rows={accounts}
            getId={(account) => account.id}
            searchableText={(account) =>
              `${account.displayName} ${account.personaLabel} ${account.handle}`
            }
            avatarField={{
              getUrl: (account) => account.avatarUrl ?? undefined,
              getFallback: (account) => account.handle.slice(0, 2).toUpperCase(),
            }}
            titleColumn={{
              header: "Account",
              render: (account) => (
                <div className="min-w-0">
                  <p className="truncate type-body font-semibold">
                    {account.displayName || account.personaLabel || account.handle}
                  </p>
                  <p className="truncate type-meta text-muted-foreground">
                    @{account.handle} · {relativeTime(account.lastActivityAt)}
                  </p>
                </div>
              ),
            }}
            statusField={{
              label: "Status",
              getValue: (account) =>
                account.isActive && account.hasToken && !account.suspended
                  ? "Ready"
                  : account.suspended
                    ? "Suspended"
                    : account.hasToken
                      ? "Inactive"
                      : "Reconnect",
              options: ["Ready", "Suspended", "Inactive", "Reconnect"],
              badgeClassName: (value) =>
                value === "Ready"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : value === "Suspended"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
            }}
            extraColumns={[
              {
                key: "actions",
                header: "",
                render: (account) => (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove.mutate(account.id)}
                    disabled={remove.isPending}
                    aria-label={`Remove ${account.handle}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ),
              },
            ]}
          />
        )}
      </div>

      <Card className="mt-5">
        <p className="type-body font-semibold">Import format</p>
        <p className="mt-1 type-meta text-muted-foreground">
          CSV/TSV headers supported: handle, email, password, proxy, totp, persona, auth_token.
          Without headers, use that same column order. A password or auth_token is required per
          account.
        </p>
      </Card>
    </WorkspaceShell>
  );
}
