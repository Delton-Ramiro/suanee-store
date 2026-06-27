import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");

  if (error) {
    const key = errorCode ?? error;
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(key)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  // Session is now stored in HTTP cookies — redirect to the page that
  // reads it, calls our Fastify backend, and stores the app JWT.
  return NextResponse.redirect(`${origin}/auth/complete`);
}
