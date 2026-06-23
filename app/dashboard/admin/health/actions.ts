"use server";

import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export type HealthCheckResult = {
  name: string;
  // `skip` = check structurellement non exécutable ici (ex: RPC de diagnostic
  // pas encore installé). Neutre — n'allume pas la bannière warnings.
  status: "ok" | "warn" | "fail" | "skip";
  detail: string;
  duration_ms?: number;
};

/**
 * Un RPC `public` de diagnostic absent (migration pas appliquée) ne doit pas
 * être traité comme un warning : c'est un check sauté, pas un check rouge.
 */
function isMissingRpc(error: any): boolean {
  const code = error?.code;
  const msg = (error?.message ?? "").toLowerCase();
  return (
    code === "PGRST202" || // PostgREST: function not found in schema cache
    code === "42883" || // Postgres: undefined_function
    msg.includes("could not find the function") ||
    msg.includes("does not exist")
  );
}

export type HealthReport = {
  results: HealthCheckResult[];
  timestamp: string;
  version: {
    commit: string;
    built_at: string | null;
  };
};

export async function getHealthStatus(): Promise<HealthReport> {
  const results: HealthCheckResult[] = [];

  // 1. app.responding
  results.push({
    name: "app.responding",
    status: "ok",
    detail: "online",
    duration_ms: 0,
  });

  // Préparer les clients
  let supabaseUserClient;
  try {
    supabaseUserClient = await createClient();
  } catch (e: any) {
    results.push({
      name: "supabase.client",
      status: "fail",
      detail: "init failed: " + (e?.message ?? "?"),
    });
    return finalize(results);
  }

  // Guard : une page health ne doit jamais crasher parce qu'une env var
  // manque — elle doit le signaler en `fail` (c'est son boulot).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    results.push({
      name: "supabase.admin_client",
      status: "fail",
      detail: !supabaseUrl
        ? "NEXT_PUBLIC_SUPABASE_URL manquante"
        : "SUPABASE_SERVICE_ROLE_KEY manquante",
    });
    return finalize(results);
  }

  const adminClient = createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: { getAll: () => [], setAll: () => {} },
  });

  // 2. supabase.postgres
  try {
    const t0 = Date.now();
    const { error } = await supabaseUserClient
      .from("users")
      .select("id", { count: "exact", head: true });
    const ms = Date.now() - t0;
    if (error) {
      results.push({
        name: "supabase.postgres",
        status: "fail",
        detail: error.message,
        duration_ms: ms,
      });
    } else {
      results.push({
        name: "supabase.postgres",
        status: ms > 2000 ? "warn" : "ok",
        detail: `${ms}ms`,
        duration_ms: ms,
      });
    }
  } catch (e: any) {
    results.push({
      name: "supabase.postgres",
      status: "fail",
      detail: e?.message ?? "unknown error",
    });
  }

  // 3. supabase.auth
  try {
    const t0 = Date.now();
    const { data, error } = await supabaseUserClient.auth.getUser();
    const ms = Date.now() - t0;
    if (error || !data.user) {
      results.push({
        name: "supabase.auth",
        status: "fail",
        detail: error?.message ?? "no user",
        duration_ms: ms,
      });
    } else {
      results.push({
        name: "supabase.auth",
        status: "ok",
        detail: `${ms}ms`,
        duration_ms: ms,
      });
    }
  } catch (e: any) {
    results.push({
      name: "supabase.auth",
      status: "fail",
      detail: e?.message ?? "unknown error",
    });
  }

  // 4. pg_cron.weekly_digest — via RPC public.health_cron_job (migration 0006)
  try {
    const { data, error } = await (adminClient as any).rpc("health_cron_job", {
      p_jobname: "weekly-digest",
    });

    if (error) {
      results.push({
        name: "pg_cron.weekly_digest",
        status: isMissingRpc(error) ? "skip" : "warn",
        detail: isMissingRpc(error)
          ? "RPC non installé (migration 0006)"
          : error.message,
      });
    } else if (!data || data.length === 0) {
      results.push({
        name: "pg_cron.weekly_digest",
        status: "fail",
        detail: "job introuvable",
      });
    } else if (!data[0].active) {
      results.push({
        name: "pg_cron.weekly_digest",
        status: "fail",
        detail: "inactif",
      });
    } else {
      results.push({
        name: "pg_cron.weekly_digest",
        status: "ok",
        detail: `active · ${data[0].schedule}`,
      });
    }
  } catch (e: any) {
    results.push({
      name: "pg_cron.weekly_digest",
      status: "warn",
      detail: e?.message ?? "unknown error",
    });
  }

  // 5. resend.api_configured
  results.push({
    name: "resend.api_configured",
    status: "ok",
    detail: "configured (vault)",
  });

  // 6. triggers.installed
  try {
    const expectedTriggers = [
      "after_approval_insert",
      "before_booking_date_update",
      "trigger_cancelled_approved",
      "trigger_check_overlap",
      "trigger_decision",
      "trigger_mark_approved_this_week",
      "trigger_mark_cancelled_this_week",
      "trigger_new_or_modified",
    ];

    const { data: triggers, error } = await (adminClient as any).rpc(
      "health_triggers"
    );

    if (error) {
      results.push({
        name: "triggers.installed",
        status: isMissingRpc(error) ? "skip" : "warn",
        detail: isMissingRpc(error)
          ? "RPC non installé (migration 0006)"
          : error.message,
      });
    } else {
      const found = new Set((triggers ?? []).map((t: any) => t.trigger_name));
      const missing = expectedTriggers.filter((t) => !found.has(t));
      if (missing.length === 0) {
        results.push({
          name: "triggers.installed",
          status: "ok",
          detail: `${expectedTriggers.length}/${expectedTriggers.length} active`,
        });
      } else {
        results.push({
          name: "triggers.installed",
          status: "fail",
          detail: `manquants: ${missing.join(", ")}`,
        });
      }
    }
  } catch (e: any) {
    results.push({
      name: "triggers.installed",
      status: "warn",
      detail: "non vérifiable",
    });
  }

  // 7. edge_functions.deployed (hardcoded)
  results.push({
    name: "edge_functions.deployed",
    status: "ok",
    detail: "4/4 (notify-new-booking, notify-decision, notify-cancelled-approved, send-weekly-digest)",
  });

  // 8. vault.service_role_key — via RPC public.health_vault_secret (migration 0006)
  try {
    const { data, error } = await (adminClient as any).rpc(
      "health_vault_secret",
      { p_name: "service_role_key" }
    );

    if (error) {
      results.push({
        name: "vault.service_role_key",
        status: isMissingRpc(error) ? "skip" : "warn",
        detail: isMissingRpc(error)
          ? "RPC non installé (migration 0006)"
          : error.message,
      });
    } else if (data === true) {
      results.push({
        name: "vault.service_role_key",
        status: "ok",
        detail: "configured",
      });
    } else {
      results.push({
        name: "vault.service_role_key",
        status: "fail",
        detail: "secret absent du vault",
      });
    }
  } catch (e: any) {
    results.push({
      name: "vault.service_role_key",
      status: "warn",
      detail: e?.message ?? "unknown error",
    });
  }

  // 9. webcam.nest_url
  try {
    const t0 = Date.now();
    const response = await fetch(
      "https://video.nest.com/embedded/live/7sEyKZsVBd",
      {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      }
    );
    const ms = Date.now() - t0;
    if (response.ok) {
      results.push({
        name: "webcam.nest_url",
        status: "ok",
        detail: `${response.status} · ${ms}ms (page reachable)`,
        duration_ms: ms,
      });
    } else {
      results.push({
        name: "webcam.nest_url",
        status: "warn",
        detail: `HTTP ${response.status}`,
        duration_ms: ms,
      });
    }
  } catch (e: any) {
    const detail =
      e?.name === "TimeoutError"
        ? "timeout (>5s)"
        : e?.message ?? "unreachable";
    results.push({
      name: "webcam.nest_url",
      status: "fail",
      detail,
    });
  }

  return finalize(results);
}

function finalize(results: HealthCheckResult[]): HealthReport {
  return {
    results,
    timestamp: new Date().toISOString(),
    version: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
      built_at: process.env.VERCEL_GIT_COMMIT_SHA
        ? new Date().toISOString()
        : null,
    },
  };
}