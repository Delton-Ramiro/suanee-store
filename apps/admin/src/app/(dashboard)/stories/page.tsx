"use client";

import Image from "next/image";
import { useState, useCallback, useTransition } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  useStories,
  useStory,
  useCreateStory,
  useUpdateStory,
  type Story,
} from "@/lib/hooks/useStories";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import SearchBar from "@/components/ui/SearchBar";
import TabPill from "@/components/ui/TabPill";
import CopyId from "@/components/ui/CopyId";
import StoryFormModal, {
  type StoryFormPayload,
} from "@/components/stories/StoryFormModal";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageStories } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Page ─────────────────────────────────────────────────────────────────── */

type ModalState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; storyId: string };

export default function StoriesPage() {
  const { user } = useAuth();
  const allowStoryManagement = canManageStories(user);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();
  const [modal, setModal] = useState<ModalState>({ mode: "closed" });

  const { data: storiesRaw, isLoading } = useStories({
    enabled: allowStoryManagement,
  });
  const createStory = useCreateStory();
  const updateStory = useUpdateStory();

  /* Load full story detail when editing */
  const editStoryId = modal.mode === "edit" ? modal.storyId : null;
  const { data: editStory, isLoading: loadingDetail } = useStory(editStoryId, {
    enabled: allowStoryManagement,
  });

  const allStories = storiesRaw ?? [];

  /* Client-side search (list API returns all, no pagination) */
  const stories = search
    ? allStories.filter((s) =>
        s.name.toLowerCase().includes(search.toLowerCase()),
      )
    : allStories;

  const handleSearch = useCallback((value: string) => {
    startTransition(() => setSearch(value));
  }, []);

  async function handleSubmit(payload: StoryFormPayload) {
    try {
      if (modal.mode === "create") {
        await createStory.mutateAsync(payload);
      } else if (modal.mode === "edit") {
        await updateStory.mutateAsync({ id: modal.storyId, data: payload });
      }
      setModal({ mode: "closed" });
    } catch {
      /* toast shown in hook */
    }
  }

  /* ── Columns ────────────────────────────────────────────────────────────── */
  const columns: TableColumn<Story>[] = [
    {
      key: "nr",
      header: "Nr. story",
      headerClassName: "w-[140px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "nome",
      header: "Nome",
      headerClassName: "w-[260px]",
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.name}
              width={40}
              height={40}
              className="w-10 h-10 rounded-md object-cover border border-border-light shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-md bg-bg border border-border-light shrink-0" />
          )}
          <span className="text-text-dark text-sm font-medium font-figtree">
            {item.name}
          </span>
        </div>
      ),
    },
    {
      key: "media",
      header: "Qt. de media",
      render: (item) => (
        <span className="text-text-dark text-sm font-figtree">
          {item._count?.slides ?? 0}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (item) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-bold font-figtree ${
            item.isActive
              ? "text-success bg-success/10"
              : "text-text-muted bg-surface-hover"
          }`}
        >
          {item.isActive ? "Ativa" : "Oculta"}
        </span>
      ),
    },
    {
      key: "date",
      header: "Data de criação",
      render: (item) => (
        <span className="text-text-body text-sm font-figtree">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Última atualização",
      render: (item) => (
        <span className="text-text-body text-sm font-figtree">
          {formatDate(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Acão",
      render: (item) => (
        <button
          type="button"
          onClick={() => setModal({ mode: "edit", storyId: item.id })}
          className="text-accent text-sm font-figtree hover:underline"
        >
          Editar
        </button>
      ),
    },
  ];

  const isModalOpen = modal.mode !== "closed";
  const isMutating = createStory.isPending || updateStory.isPending;

  if (!allowStoryManagement) {
    return <AccessDeniedState message="A sua role não pode gerir stories." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Gestão de stories"
        actionLabel="Criar story"
        onAction={() => setModal({ mode: "create" })}
      />

      <div className="bg-card rounded-xl shadow-card p-6 flex flex-col gap-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="w-max">
            <TabPill
              tabs={[
                {
                  id: "all",
                  label: "Todos stories",
                  count: allStories.length,
                },
              ]}
              activeTab="all"
            />
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
            <SearchBar
              value={search}
              onChange={handleSearch}
              placeholder="Procure pelo nome ou número"
              className="w-full sm:w-66"
            />
            <button
              type="button"
              className="flex items-center justify-center w-10 h-10 rounded-md bg-card border border-border text-text-muted hover:bg-surface-hover transition-colors shrink-0"
              title="Ordenar"
            >
              <ArrowUpDown size={18} />
            </button>
          </div>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          rows={stories}
          keyExtractor={(item) => item.id}
          loading={isLoading}
          emptyMessage="Nenhuma story encontrada."
        />
      </div>

      {/* Modal */}
      <StoryFormModal
        open={isModalOpen}
        onClose={() => setModal({ mode: "closed" })}
        onSubmit={handleSubmit}
        initial={modal.mode === "edit" ? editStory : undefined}
        loading={isMutating || (modal.mode === "edit" && loadingDetail)}
      />
    </div>
  );
}
