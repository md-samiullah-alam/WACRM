import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getActivePlan } from "@/lib/subscription/subscription";

export async function GET() {
  const supabase = await createClient();

  // getActivePlan has built-in fallback to hardcoded defaults
  // if the DB migration hasn't been applied yet
  const plan = await getActivePlan(supabase);
  const plans = plan ? [plan] : [];

  return NextResponse.json({ plans });
}