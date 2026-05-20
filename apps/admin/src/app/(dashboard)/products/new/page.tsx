"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useBrands } from "@/lib/hooks/useBrands";
import { useCreateProduct } from "@/lib/hooks/useAdminProduct";
import { slugify } from "@/lib/format";
import { toast } from "sonner";
import ApiSearchSelect from "@/components/ui/ApiSearchSelect";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { canCreateProducts } from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

export default function NewProductPage() {
  const router = useRouter();
  const { user } = useAuth();
  const allowCreateProduct = canCreateProducts(user);
  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");

  const { data: brandsData } = useBrands({ limit: 100 });
  const brands = brandsData?.items ?? [];

  const createProduct = useCreateProduct();
  const isPending = createProduct.isPending;

  if (!allowCreateProduct) {
    return <AccessDeniedState message="A sua role não pode criar produtos." />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allowCreateProduct) return;
    if (!name.trim()) return toast.error("O nome é obrigatório");
    if (!brandId) return toast.error("A marca é obrigatória");
    try {
      const product = await createProduct.mutateAsync({
        name: name.trim(),
        slug: slugify(name.trim()),
        brandId,
        basePrice: 0,
        stockStatus: "in_stock",
        status: "draft",
      });
      router.push(`/products/${product.id}`);
    } catch {
      // error already shown via hook
    }
  }

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-text-muted hover:text-primary text-s font-figtree mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Voltar
      </button>

      <div className="bg-card rounded-xl border border-border-light p-6 flex flex-col gap-5">
        <h1 className="text-[20px] font-bold text-primary font-lato">
          Novo produto
        </h1>
        <p className="text-s text-text-muted font-figtree -mt-3">
          Preencha os dados básicos para criar o rascunho. Poderá completar o
          produto depois.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-primary font-figtree">
              Nome do produto <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Air Max 270"
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-text-dark text-sm font-figtree placeholder:text-text-label focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          {/* Brand */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-primary font-figtree">
              Marca <span className="text-danger">*</span>
            </label>
            <ApiSearchSelect
              value={brandId}
              onChange={setBrandId}
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Selecionar marca…"
              searchPlaceholder="Pesquisar marca…"
              onSearch={async (q) => {
                const res = await apiFetch<{
                  items: { id: string; name: string }[];
                }>(`/admin/brands?search=${encodeURIComponent(q)}&limit=20`);
                return res.items.map((b) => ({ value: b.id, label: b.name }));
              }}
            />
          </div>

          <div className="border-t border-border-light pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isPending || !name.trim() || !brandId}
              className="px-6 py-2.5 rounded-lg bg-navy text-white text-sm font-semibold font-figtree hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "A criar…" : "Criar e editar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
