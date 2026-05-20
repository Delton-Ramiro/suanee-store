"use client";

import Image from "next/image";
import { useState, useCallback, useTransition } from "react";
import { ArrowUpDown, CirclePlus } from "lucide-react";
import {
  useAdmins,
  useCreateAdmin,
  useUpdateAdmin,
  useDeactivateAdmin,
  useActivateAdmin,
  type AdminUser,
} from "@/lib/hooks/useAuthority";
import AuthorityFormModal, {
  type AuthorityFormPayload,
  type AuthorityUpdatePayload,
} from "@/components/authority/AuthorityFormModal";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import CopyId from "@/components/ui/CopyId";
import TabPill from "@/components/ui/TabPill";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  canManageAuthority,
  getAdminRolePresentation,
} from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; admin: AdminUser };

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function Avatar({ admin }: { admin: AdminUser }) {
  const initials = admin.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  if (admin.avatarUrl) {
    return (
      <Image
        src={admin.avatarUrl}
        alt={admin.name}
        width={36}
        height={36}
        className="w-9 h-9 rounded-full object-cover border border-border-light"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center">
      <span className="text-[12px] font-bold text-white font-figtree">
        {initials}
      </span>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium font-figtree ${
        isActive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-success" : "bg-danger"}`}
      />
      {isActive ? "Ativo" : "Inativo"}
    </span>
  );
}

function RoleBadge({ admin }: { admin: AdminUser }) {
  const role = getAdminRolePresentation(admin);
  return (
    <span className="text-s text-text-body font-figtree">
      {role?.label ?? "Personalizado"}
    </span>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function AdminAuthorityPage() {
  const { user } = useAuth();
  const allowAuthorityManagement = canManageAuthority(user);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });
  const [page, setPage] = useState(1);
  const [, startTransition] = useTransition();

  const PAGE_SIZE = 20;

  const { data, isLoading } = useAdmins(
    { page, limit: PAGE_SIZE },
    { enabled: allowAuthorityManagement },
  );
  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deactivateAdmin = useDeactivateAdmin();
  const activateAdmin = useActivateAdmin();

  const allAdmins = data?.items ?? [];

  // Client-side search filter
  const admins = search.trim()
    ? allAdmins.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.email.toLowerCase().includes(search.toLowerCase()),
      )
    : allAdmins;

  // Client-side sort
  const sorted = [...admins].sort((a, b) => {
    const da = new Date(a.createdAt).getTime();
    const db = new Date(b.createdAt).getTime();
    return sortOrder === "asc" ? da - db : db - da;
  });

  const handleSearch = useCallback((v: string) => {
    startTransition(() => {
      setSearch(v);
      setPage(1);
    });
  }, []);

  function toggleSort() {
    setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  async function handleCreate(payload: AuthorityFormPayload) {
    if (!allowAuthorityManagement) return;
    await createAdmin.mutateAsync(payload);
    setModal({ mode: "closed" });
  }

  async function handleUpdate(payload: AuthorityUpdatePayload) {
    if (!allowAuthorityManagement) return;
    if (modal.mode !== "edit") return;
    const id = modal.admin.id;
    await updateAdmin.mutateAsync({ id, data: payload });
    // Handle activate/deactivate if isActive changed
    if (
      payload.isActive !== undefined &&
      payload.isActive !== modal.admin.isActive
    ) {
      if (payload.isActive) {
        await activateAdmin.mutateAsync(id);
      } else {
        await deactivateAdmin.mutateAsync(id);
      }
    }
    setModal({ mode: "closed" });
  }

  /* ── Table columns ──────────────────────────────────────────────────────── */
  const columns: TableColumn<AdminUser>[] = [
    {
      key: "id",
      header: "Nr.",
      headerClassName: "w-[120px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "user",
      header: "Utilizador",
      render: (item) => (
        <div className="flex items-center gap-3">
          <Avatar admin={item} />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-text-dark truncate">
              {item.name}
            </span>
            <span className="text-sm text-text-muted truncate">
              {item.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      headerClassName: "w-[200px]",
      render: (item) => <RoleBadge admin={item} />,
    },
    {
      key: "status",
      header: "Estado",
      headerClassName: "w-[100px]",
      render: (item) => <StatusBadge isActive={item.isActive} />,
    },
    {
      key: "lastLogin",
      header: "Último acesso",
      headerClassName: "w-[140px]",
      render: (item) => (
        <span className="text-s text-text-body font-inter">
          {item.lastLoginAt ? formatDate(item.lastLoginAt) : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Data de criação",
      headerClassName: "w-[120px]",
      render: (item) => (
        <span className="text-s text-text-body font-inter">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) =>
        allowAuthorityManagement ? (
          <button
            onClick={() => setModal({ mode: "edit", admin: item })}
            className="text-accent text-sm font-medium hover:underline"
          >
            Editar
          </button>
        ) : null,
    },
  ];

  const isMutating = createAdmin.isPending || updateAdmin.isPending;

  return (
    <>
      <PageHeader
        title="Gestão de autoridade"
        actionLabel={allowAuthorityManagement ? "Criar acesso" : undefined}
        onAction={
          allowAuthorityManagement
            ? () => setModal({ mode: "create" })
            : undefined
        }
      />

      {!allowAuthorityManagement ? (
        <AccessDeniedState message="A gestão de acessos não está disponível para a sua role." />
      ) : (
        <div className="bg-card rounded-lg shadow-card overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between  gap-3 px-6 py-4 border-b border-border-light">
            <div className="w-max">
              <TabPill
                tabs={[
                  {
                    id: "all",
                    label: "Todos os administradores",
                    count: data?.total,
                  },
                ]}
                activeTab="all"
              />
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
              <SearchBar
                value={search}
                onChange={handleSearch}
                placeholder="Procure pelo nome ou email"
                className="w-full sm:w-66"
              />
              <button
                onClick={() => setModal({ mode: "create" })}
                className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
                aria-label="Criar acesso"
              >
                <CirclePlus size={18} />
              </button>
              <button
                onClick={toggleSort}
                title={
                  sortOrder === "asc" ? "Ordem decrescente" : "Ordem crescente"
                }
                className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              >
                <ArrowUpDown size={18} />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="px-6 pb-2 pt-4">
            <DataTable
              columns={columns}
              rows={sorted}
              keyExtractor={(a) => a.id}
              loading={isLoading}
              emptyMessage="Nenhum administrador encontrado."
            />
          </div>

          {/* Range indicator */}
          {!isLoading && (data?.total ?? 0) > 0 && (
            <div className="px-6 pb-4 pt-1 text-right">
              <span className="text-s font-inter text-text-subtle">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, data!.total)} de {data!.total}
              </span>
            </div>
          )}
        </div>
      )}

      {allowAuthorityManagement && (
        <Pagination
          page={page}
          total={data?.totalPages ?? 1}
          onPageChange={setPage}
        />
      )}

      {allowAuthorityManagement && (
        <AuthorityFormModal
          open={modal.mode !== "closed"}
          onClose={() => setModal({ mode: "closed" })}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          initial={modal.mode === "edit" ? modal.admin : undefined}
          loading={isMutating}
        />
      )}
    </>
  );
}
