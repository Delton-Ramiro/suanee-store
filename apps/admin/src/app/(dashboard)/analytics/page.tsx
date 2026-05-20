"use client";

import { useAuth } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

export default function AnalyticsPage() {
  const { user } = useAuth();

  if (!canViewAnalytics(user)) {
    return (
      <AccessDeniedState message="A sua role não pode aceder às análises." />
    );
  }

  return <div>Análises — em construção.</div>;
}
