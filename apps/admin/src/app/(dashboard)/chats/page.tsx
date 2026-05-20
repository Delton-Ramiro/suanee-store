"use client";

import { useAuth } from "@/lib/auth";
import { canViewChats } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

export default function ChatsPage() {
  const { user } = useAuth();

  if (!canViewChats(user)) {
    return (
      <AccessDeniedState message="A sua role não pode aceder às conversas." />
    );
  }

  return <div>Conversas — em construção.</div>;
}
