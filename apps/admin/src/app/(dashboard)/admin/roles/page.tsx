"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SYSTEM_ROLE_OPTIONS, canManageAuthority } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

export default function AdminRolesPage() {
  const { user } = useAuth();
  const allowManagement = canManageAuthority(user);

  if (!allowManagement) {
    return (
      <AccessDeniedState message="A sua role não pode gerir as roles administrativas." />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/roles/permissions-guide"
        className="inline-flex items-center gap-2 self-start h-10 px-5 rounded-xl bg-navy text-white text-s font-lato font-semibold hover:bg-primary transition-colors"
      >
        <BookOpen size={16} />
        Guia de Permissões
      </Link>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SYSTEM_ROLE_OPTIONS.map((role) => (
          <article
            key={role.roleKey}
            className="rounded-2xl border border-border-light bg-card p-5 shadow-card"
          >
            <p className="text-sm font-semibold text-primary font-lato">
              {role.label}
            </p>
            <p className="mt-2 text-sm text-text-body font-figtree leading-relaxed">
              {role.description}
            </p>
          </article>
        ))}
      </div>

      <p className="text-text-muted text-s font-figtree">
        {allowManagement
          ? "Estas roles já estão ligadas ao backend e podem ser atribuídas em Controle de autoridade."
          : "As roles disponíveis do sistema estão listadas aqui apenas para referência."}
      </p>
    </div>
  );
}
