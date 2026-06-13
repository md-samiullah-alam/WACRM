import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { getActivePlan, getAnyAccountSubscription } from "@/lib/subscription/subscription";

/**
 * POST /api/subscription/razorpay/create-order
 * Creates Razorpay order for initial purchase or annual renewal.
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
    .select("account_id, account_role")
    .eq("user_id", user.id)
    .single();
  if (profileError || !profile?.account_id) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.account_role !== "owner" && profile.account_role !== "admin") {
    return NextResponse.json(
      { error: "Only account admins can purchase plans" },
      { status: 403 }
    );
  }

  const accountId = profile.account_id;

  let paymentType: "initial" | "annual" = "initial";
  try {
    const b = await request.json();
    if (b?.paymentType === "annual") {
      paymentType = "annual";
    }
  } catch {
    // no body — default to initial purchase
  }

  const plan = await getActivePlan(supabase);
  if (!plan) {
    return NextResponse.json({ error: "No active plan found" }, { status: 404 });
  }

  // For annual renewal, verify there's an existing subscription
  if (paymentType === "annual") {
    const existingSub = await getAnyAccountSubscription(supabase, accountId);
    if (!existingSub) {
      return NextResponse.json(
        { error: "No existing subscription to renew" },
        { status: 400 }
      );
    }
  }

  const amount = paymentType === "annual" ? Number(plan.annual_fee) : Number(plan.base_price) + Number(plan.annual_fee);

  const razorpay = new Razorpay({
    key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `${paymentType}_${accountId.slice(0, 8)}_${Date.now()}`,
      notes: {
        account_id: accountId,
        user_id: user.id,
        payment_type: paymentType,
        plan_slug: plan.slug,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount,
      currency: "INR",
      description:
        paymentType === "annual"
          ? `Annual Support — ₹${Number(plan.annual_fee).toLocaleString()}`
          : `Yearly Plan — ₹${(Number(plan.base_price) + Number(plan.annual_fee)).toLocaleString()}`,
      plan: { name: plan.name, base_price: Number(plan.base_price), annual_fee: Number(plan.annual_fee) },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Razorpay error";
    console.error("[Razorpay] Order creation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
