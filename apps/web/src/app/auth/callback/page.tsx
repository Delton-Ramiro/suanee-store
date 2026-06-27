"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// This route is no longer used for OAuth — the server handler at
// /api/auth/callback now handles the Supabase PKCE code exchange.
// Redirect anyone who lands here directly.
export default function OldCallbackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
