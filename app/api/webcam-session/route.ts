import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let duration: number;
  try {
    const body = await req.json();
    duration = Number(body?.duration_seconds);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Validation : 3s minimum, 4h maximum (anti-tab-laissé-ouvert-toute-la-nuit)
  if (
    !Number.isFinite(duration) ||
    duration < 3 ||
    duration > 4 * 60 * 60
  ) {
    return NextResponse.json({ error: "invalid duration" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("webcam_sessions").insert({
    user_id: user.id,
    duration_seconds: Math.round(duration),
  });

  if (error) {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}