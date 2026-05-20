"use client";

import Image from "next/image";
import { useState, useCallback, useTransition } from "react";
import { ArrowUpDown, CirclePlus } from "lucide-react";
import {
  useSizes,
  useCreateSize,
  useUpdateSize,
  useDeleteSize,
  useSizeGuides,
  useCreateSizeGuide,
  useUpdateSizeGuide,
  useDeleteSizeGuide,
  type Size,
  type SizeGuide,
} from "@/lib/hooks/useSizes";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import SearchBar from "@/components/ui/SearchBar";
import Pagination from "@/components/ui/Pagination";
import TabPill from "@/components/ui/TabPill";
import CopyId from "@/components/ui/CopyId";
import SizeFormModal, {
  type SizeFormPayload,
} from "@/components/sizes/SizeFormModal";
import SizeGuideFormModal, {
  type SizeGuideFormPayload,
} from "@/components/sizes/SizeGuideFormModal";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { canManageSizes } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

const PAGE_SIZE = 20;

/* ─── Image thumbnail strip ─────────────────────────────────────────────── */
function GuideThumbnails({ guide }: { guide: SizeGuide }) {
  const imgs = [...(guide.images ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  if (imgs.length === 0)
    return <span className="text-text-subtle text-s font-figtree">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      {imgs.slice(0, 4).map((img, i) => (
        <div
          key={i}
          className="relative w-9 h-9 rounded-md overflow-hidden border border-border-light shrink-0 bg-bg"
        >
          <Image
            fill
            src={img.url}
            alt={`img-${i}`}
            className="object-cover"
            sizes="36px"
          />
        </div>
      ))}
      {imgs.length > 4 && (
        <span className="text-[12px] text-text-muted font-figtree">
          +{imgs.length - 4}
        </span>
      )}
    </div>
  );
}

export default function SizesPage() {
  const { user } = useAuth();
  const allowSizeManagement = canManageSizes(user);
  const [, startTransition] = useTransition();

  /* ── Tab ────────────────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<"sizes" | "guides">("sizes");

  /* ── Sizes state ────────────────────────────────────────────────────────── */
  const [sizeSearch, setSizeSearch] = useState("");
  const [sizeSortOrder, setSizeSortOrder] = useState<"asc" | "desc">("asc");
  const [sizePage, setSizePage] = useState(1);

  const { data: sizesData, isLoading: sizesLoading } = useSizes({
    page: sizePage,
    limit: PAGE_SIZE,
    search: sizeSearch || undefined,
    sortOrder: sizeSortOrder,
  });
  const sizes = sizesData?.items ?? [];
  const sizesTotal = sizesData?.total ?? 0;
  const sizesTotalPages = sizesData?.totalPages ?? 1;

  /* ── Size modals ─────────────────────────────────────────────────────────── */
  const [sizeModal, setSizeModal] = useState<{
    open: boolean;
    editItem?: Size;
  }>({ open: false });

  const { mutateAsync: createSize, isPending: creatingSize } = useCreateSize();
  const { mutateAsync: updateSize, isPending: updatingSize } = useUpdateSize();
  const { mutateAsync: deleteSize } = useDeleteSize();

  async function handleSizeSubmit(payload: SizeFormPayload) {
    if (sizeModal.editItem) {
      await updateSize({ id: sizeModal.editItem.id, data: payload });
    } else {
      await createSize(payload);
    }
    setSizeModal({ open: false });
  }

  async function handleSizeDelete() {
    if (!sizeModal.editItem) return;
    await deleteSize(sizeModal.editItem.id);
    setSizeModal({ open: false });
  }

  /* ── Guides state ───────────────────────────────────────────────────────── */
  const [guideSearch, setGuideSearch] = useState("");
  const [guideSortOrder, setGuideSortOrder] = useState<"asc" | "desc">("desc");
  const [guidePage, setGuidePage] = useState(1);

  const { data: guidesData, isLoading: guidesLoading } = useSizeGuides({
    page: guidePage,
    limit: PAGE_SIZE,
    search: guideSearch || undefined,
    sortOrder: guideSortOrder,
  });
  const guides = guidesData?.items ?? [];
  const guidesTotal = guidesData?.total ?? 0;
  const guidesTotalPages = guidesData?.totalPages ?? 1;

  /* ── Guide modals ────────────────────────────────────────────────────────── */
  const [guideModal, setGuideModal] = useState<{
    open: boolean;
    editItem?: SizeGuide;
  }>({ open: false });

  const { mutateAsync: createGuide, isPending: creatingGuide } =
    useCreateSizeGuide();
  const { mutateAsync: updateGuide, isPending: updatingGuide } =
    useUpdateSizeGuide();
  const { mutateAsync: deleteGuide } = useDeleteSizeGuide();

  async function handleGuideSubmit(payload: SizeGuideFormPayload) {
    if (guideModal.editItem) {
      await updateGuide({ id: guideModal.editItem.id, data: payload });
    } else {
      await createGuide(payload);
    }
    setGuideModal({ open: false });
  }

  async function handleGuideDelete() {
    if (!guideModal.editItem) return;
    await deleteGuide(guideModal.editItem.id);
    setGuideModal({ open: false });
  }

  if (!allowSizeManagement) {
    return <AccessDeniedState message="A sua role não pode gerir tamanhos." />;
  }

  /* ── Search handlers ────────────────────────────────────────────────────── */
  const handleSizeSearch = useCallback((value: string) => {
    startTransition(() => {
      setSizeSearch(value);
      setSizePage(1);
    });
  }, []);

  const handleGuideSearch = useCallback((value: string) => {
    startTransition(() => {
      setGuideSearch(value);
      setGuidePage(1);
    });
  }, []);

  /* ── Columns: sizes ─────────────────────────────────────────────────────── */
  const sizeColumns: TableColumn<Size>[] = [
    {
      key: "nr",
      header: "Nr. tamanho",
      headerClassName: "w-[130px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "nome",
      header: "Nome",
      render: (item) => (
        <span className="text-text-dark text-sm font-medium font-figtree">
          {item.name}
        </span>
      ),
    },
    {
      key: "etiqueta",
      header: "Etiqueta",
      headerClassName: "w-[100px]",
      render: (item) => (
        <span className="inline-flex items-center justify-center min-w-9 px-2.5 py-1 bg-navy/10 text-navy text-s font-bold font-inter rounded-md">
          {item.label}
        </span>
      ),
    },
    {
      key: "sistema",
      header: "Sistema",
      headerClassName: "w-[110px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s uppercase">
          {item.sizeSystem}
        </span>
      ),
    },
    {
      key: "categorias",
      header: "Categorias",
      render: (item) => {
        const cats = item.sizeCategories ?? [];
        if (cats.length === 0)
          return (
            <span className="text-text-subtle text-s font-figtree">—</span>
          );
        return (
          <div className="flex flex-wrap gap-1">
            {cats.slice(0, 3).map((sc) => (
              <span
                key={sc.category.id}
                className="text-xxs font-figtree bg-surface-hover text-text-body px-2 py-0.5 rounded-full border border-border-light"
              >
                {sc.category.name}
              </span>
            ))}
            {cats.length > 3 && (
              <span className="text-xxs font-figtree text-text-muted">
                +{cats.length - 3}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "created",
      header: "Data de criação",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Última atualização",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <button
          onClick={() => setSizeModal({ open: true, editItem: item })}
          className="text-accent text-sm font-medium hover:underline"
        >
          Detalhes
        </button>
      ),
    },
  ];

  /* ── Columns: guides ────────────────────────────────────────────────────── */
  const guideColumns: TableColumn<SizeGuide>[] = [
    {
      key: "nr",
      header: "Nr. guia",
      headerClassName: "w-[130px]",
      render: (item) => <CopyId id={item.id} />,
    },
    {
      key: "nome",
      header: "Nome",
      render: (item) => (
        <span className="text-text-dark text-sm font-medium font-figtree">
          {item.name}
        </span>
      ),
    },
    {
      key: "descricao",
      header: "Descrição",
      render: (item) =>
        item.description ? (
          <span className="text-text-body text-s font-figtree line-clamp-1">
            {item.description}
          </span>
        ) : (
          <span className="text-text-subtle text-s font-figtree">—</span>
        ),
    },
    {
      key: "imagens",
      header: "Imagens",
      headerClassName: "w-[200px]",
      render: (item) => <GuideThumbnails guide={item} />,
    },
    {
      key: "created",
      header: "Data de criação",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: "updated",
      header: "Última atualização",
      headerClassName: "w-[160px]",
      render: (item) => (
        <span className="text-text-body font-inter text-s">
          {formatDate(item.updatedAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[80px]",
      render: (item) => (
        <button
          onClick={() => setGuideModal({ open: true, editItem: item })}
          className="text-accent text-sm font-medium hover:underline"
        >
          Detalhes
        </button>
      ),
    },
  ];

  const isOnSizes = activeTab === "sizes";

  return (
    <>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-[20px] font-bold text-primary font-lato tracking-[0.04em]">
          Gestão de tamanhos e guias
        </h2>
        <div className="self-start sm:self-auto flex items-center gap-3">
          <button
            onClick={() => setSizeModal({ open: true })}
            className="flex items-center gap-2 bg-navy text-white text-md font-bold font-figtree pl-3 pr-5 py-3 rounded-lg hover:opacity-90 active:opacity-80 transition-opacity"
          >
            <CirclePlus size={20} />
            Criar tamanho
          </button>
          <button
            onClick={() => setGuideModal({ open: true })}
            className="flex items-center gap-2 border border-navy text-navy text-md font-bold font-figtree pl-3 pr-5 py-2.75 rounded-lg hover:bg-navy/5 active:bg-navy/10 transition-colors"
          >
            <CirclePlus size={20} />
            Criar guia
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="bg-card rounded-lg shadow-card overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-border-light">
          <div className="w-max">
            <TabPill
              tabs={[
                { id: "sizes", label: "Tamanhos", count: sizesTotal },
                { id: "guides", label: "Guia de tamanhos", count: guidesTotal },
              ]}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as "sizes" | "guides")}
            />
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto overflow-x-auto">
            {isOnSizes ? (
              <>
                <SearchBar
                  value={sizeSearch}
                  onChange={handleSizeSearch}
                  placeholder="Procure pelo nome ou etiqueta"
                  className="w-full sm:w-66"
                />
                <button
                  onClick={() => setSizeModal({ open: true })}
                  title="Criar tamanho"
                  className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
                >
                  <CirclePlus size={18} />
                </button>
                <button
                  onClick={() => {
                    setSizeSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                    setSizePage(1);
                  }}
                  title={
                    sizeSortOrder === "asc"
                      ? "Ordem decrescente"
                      : "Ordem crescente"
                  }
                  className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
                >
                  <ArrowUpDown size={18} />
                </button>
              </>
            ) : (
              <>
                <SearchBar
                  value={guideSearch}
                  onChange={handleGuideSearch}
                  placeholder="Procure pelo nome do guia"
                  className="w-full sm:w-66"
                />
                <button
                  onClick={() => setGuideModal({ open: true })}
                  title="Criar guia"
                  className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
                >
                  <CirclePlus size={18} />
                </button>
                <button
                  onClick={() => {
                    setGuideSortOrder((p) => (p === "asc" ? "desc" : "asc"));
                    setGuidePage(1);
                  }}
                  title={
                    guideSortOrder === "asc"
                      ? "Mais recentes primeiro"
                      : "Mais antigos primeiro"
                  }
                  className="flex items-center justify-center w-10 h-10 bg-card border border-border rounded text-text-muted hover:bg-surface-hover transition-colors shrink-0"
                >
                  <ArrowUpDown size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="px-6 pb-2 pt-4">
          {isOnSizes ? (
            <DataTable
              columns={sizeColumns}
              rows={sizes}
              keyExtractor={(item) => item.id}
              loading={sizesLoading}
              emptyMessage="Nenhum tamanho encontrado."
            />
          ) : (
            <DataTable
              columns={guideColumns}
              rows={guides}
              keyExtractor={(item) => item.id}
              loading={guidesLoading}
              emptyMessage="Nenhum guia de tamanhos encontrado."
            />
          )}
        </div>

        {/* Range indicator */}
        {isOnSizes
          ? !sizesLoading &&
            sizesTotal > 0 && (
              <div className="px-6 pb-4 pt-1 text-right">
                <span className="text-s font-inter text-text-subtle">
                  {(sizePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(sizePage * PAGE_SIZE, sizesTotal)} de {sizesTotal}
                </span>
              </div>
            )
          : !guidesLoading &&
            guidesTotal > 0 && (
              <div className="px-6 pb-4 pt-1 text-right">
                <span className="text-s font-inter text-text-subtle">
                  {(guidePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(guidePage * PAGE_SIZE, guidesTotal)} de{" "}
                  {guidesTotal}
                </span>
              </div>
            )}
      </div>

      {/* Pagination */}
      {isOnSizes ? (
        <Pagination
          page={sizePage}
          total={sizesTotalPages}
          onPageChange={setSizePage}
        />
      ) : (
        <Pagination
          page={guidePage}
          total={guidesTotalPages}
          onPageChange={setGuidePage}
        />
      )}

      {/* Size modal */}
      <SizeFormModal
        open={sizeModal.open}
        onClose={() => setSizeModal({ open: false })}
        onSubmit={handleSizeSubmit}
        initial={sizeModal.editItem}
        loading={creatingSize || updatingSize}
      />

      {/* Guide modal */}
      <SizeGuideFormModal
        open={guideModal.open}
        onClose={() => setGuideModal({ open: false })}
        onSubmit={handleGuideSubmit}
        onDelete={guideModal.editItem ? handleGuideDelete : undefined}
        initial={guideModal.editItem}
        loading={creatingGuide || updatingGuide}
      />
    </>
  );
}
