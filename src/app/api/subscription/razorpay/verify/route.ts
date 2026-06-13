import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyRazorpaySignature, activateSubscription } from "@/lib/subscription/payment";

/**
 * POST /api/subscription/razorpay/verify
 *
 * Verifies Razorpay payment signature and activates the subscription.
 * Handles both new subscriptions and renewals/existing reactivations.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", user.id)
    .single();
  if (profileError || !profile?.account_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const accountId = profile.account_id;

  let body: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json(
      { error: "Missing payment fields" },
      { status: 400 }
    );
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json(
      { error: "Razorpay not configured" },
      { status: 500 }
    );
  }

  if (!verifyRazorpaySignature(body, keySecret)) {
    return NextResponse.json(
      { error: "Payment verification failed — invalid signature" },
      { status: 400 }
    );
  }

  const result = await activateSubscription(supabase, {
    accountId,
    userId: user.id,
    payment: body,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to activate subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, subscription: result.subscription });
}
