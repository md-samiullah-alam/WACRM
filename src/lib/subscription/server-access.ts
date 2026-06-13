import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { checkFeatureAccess } from "./access";

/**
 * Server-side middleware for API routes.
 * Returns the supabase client and accountId if access is granted,
 * or a JSON error response if not.
 */
export async function requireServerAccess(): Promise<
  | { supabase: Awaited<ReturnType<typeof createClient>>; accountId: string; userId: string }
  | NextResponse
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile?.account_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 }) as NextResponse;
  }

  const accountId = profile.account_id;

  const access = await checkFeatureAccess(supabase, accountId);

  if (!access.granted) {
    return NextResponse.json(
      {
        error: "Premium feature required. Your free trial has ended. Please purchase a plan.",
        reason: access.reason,
      },
      { status: 403 }
    ) as NextResponse;
  }

  return { supabase, accountId, userId: user.id };
}
