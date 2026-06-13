/**
 * One-time script to apply migration 024 to the remote Supabase project.
 * Uses the service role key from .env.local.
 *
 * Run with: npx tsx scripts/run-migration-024.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const sqlPath = path.join(__dirname, "..", "supabase", "migrations", "024_consolidated_subscription_fix.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");

  console.log("Applying migration 024 to remote Supabase...");

  const { error } = await supabase.rpc("exec_sql", { sql_text: sql }).single();

  if (error) {
    // exec_sql doesn't exist — try splitting into individual statements
    console.log("exec_sql RPC not available, using SQL via REST...");

    // Split on semicolons and run each statement
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        // Use the management API via REST
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
          body: JSON.stringify({ sql_text: stmt + ";" }),
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error(`Statement ${i + 1} failed: ${errText.substring(0, 200)}`);
        } else {
          console.log(`✓ Statement ${i + 1}/${statements.length} OK`);
        }
      } catch (err) {
        console.error(`Statement ${i + 1} error:`, err);
      }
    }
  } else {
    console.log("✓ Migration 024 applied successfully via exec_sql RPC");
  }

  // Quick verification
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, trial_started_at")
    .limit(3);

  console.log("\nSample accounts:", JSON.stringify(accounts, null, 2));
  console.log("\nDone!");
}

main().catch(console.error);