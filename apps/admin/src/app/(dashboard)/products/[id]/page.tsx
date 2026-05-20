"use client";

import { use, useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useAdminProduct, useUpdateProduct } from "@/lib/hooks/useAdminProduct";
import type { MediaDraft } from "@/components/products/ProductMediaZone";
import ProductMediaZone from "@/components/products/ProductMediaZone";
import { useBrands } from "@/lib/hooks/useBrands";
import { useColors } from "@/lib/hooks/useColors";
import { useSizes, useSizeGuides } from "@/lib/hooks/useSizes";
import { useCategories } from "@/lib/hooks/useCategories";
import { useCollections } from "@/lib/hooks/useCollections";
import { useFilters, type Filter } from "@/lib/hooks/useFilters";
import { useCurrencyRates } from "@/lib/hooks/useCurrency";
import Toggle from "@/components/ui/Toggle";
import SearchableSelect from "@/components/ui/SearchableSelect";
import ApiSearchSelect from "@/components/ui/ApiSearchSelect";
import MultiSelectDropdown from "@/components/ui/MultiSelectDropdown";
import { apiFetch, ApiError } from "@/lib/api";
import { slugify } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  canEditSpecificProduct,
  canViewProducts,
  forcesHiddenProductSave,
} from "@/lib/admin-access";
import AccessDeniedState from "@/components/AccessDeniedState";

/* ── Local helpers ─────────────────────────────────────────────────────────── */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[18px] font-bold text-navy font-lato leading-tight">
      {children}
    </h3>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-s font-semibold text-text-dark font-figtree mb-1.5">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  suffix?: string;
}) {
  return (
    <div className="relative flex items-center">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full h-12 px-3 rounded-xl border border-border bg-card text-text-dark text-sm font-figtree placeholder:text-text-label focus:outline-none focus:border-accent transition-colors disabled:bg-surface-hover disabled:cursor-default"
        style={suffix ? { paddingRight: "56px" } : undefined}
      />
      {suffix && (
        <span className="absolute right-3 text-s text-text-muted font-figtree">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 5,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full px-3 py-3 rounded-xl border border-border bg-card text-text-dark text-sm font-figtree placeholder:text-text-label focus:outline-none focus:border-accent transition-colors resize-none disabled:bg-surface-hover disabled:cursor-default"
    />
  );
}

/* ── Types ─────────────────────────────────────────────────────────────────── */

type VariantConfig = {
  stockQuantity: string;
  price: string;
  hasDiscount: boolean;
  discountPrice: string;
  isIndicativePrice: boolean;
  position: string;
};

function defaultVariantConfig(): VariantConfig {
  return {
    stockQuantity: "0",
    price: "",
    hasDiscount: false,
    discountPrice: "",
    isIndicativePrice: false,
    position: "0",
  };
}

type FilterAssignment = {
  filterId: string;
  filterName: string;
  categoryLevel: "L0" | "L1" | "L2";
  values: { id: string; label: string; value: string }[];
};

type SupplierRow = {
  id: string; // local React key
  dbId: string | null; // null when not yet persisted
  supplierName: string;
  supplierLink: string;
  address: string;
  contact: string;
  supplierPrice: string; // price in foreign currency
  priceWithDelivery: string; // cost with delivery, foreign currency
  currencyRateId: string;
  deliveryTax: string; // city delivery tax in MZN
  otherCosts: string; // other costs in MZN
  proposedPrice: string; // proposed selling price in MZN
};

type CompetitorEntry = {
  id: string;
  dbId: string | null;
  name: string;
  link: string;
  price: string;
  comment: string;
};

function newSupplierRow(defaultProposedPrice = ""): SupplierRow {
  return {
    id: Math.random().toString(36).slice(2),
    dbId: null,
    supplierName: "",
    supplierLink: "",
    address: "",
    contact: "",
    supplierPrice: "",
    priceWithDelivery: "",
    currencyRateId: "",
    deliveryTax: "",
    otherCosts: "",
    proposedPrice: defaultProposedPrice,
  };
}

function newCompetitor(): CompetitorEntry {
  return {
    id: Math.random().toString(36).slice(2),
    dbId: null,
    name: "",
    link: "",
    price: "",
    comment: "",
  };
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const allowProductView = canViewProducts(user);

  const { data: product, isLoading } = useAdminProduct(id, {
    enabled: allowProductView,
  });
  const updateProduct = useUpdateProduct(id);

  /* Reference data */
  const { data: brandsData } = useBrands({ limit: 10 });
  const { data: colorsData } = useColors({ limit: 10 });
  const { data: sizeGuidesData } = useSizeGuides({ limit: 10 });
  const { data: collectionsData } = useCollections({ limit: 10 });
  const { data: l0Cats } = useCategories({ level: 0 });
  const { data: l1Cats } = useCategories({ level: 1 });
  const { data: l2Cats } = useCategories({ level: 2 });
  const { data: filtersPage1 } = useFilters({ limit: 100 });
  const { data: currencyRates } = useCurrencyRates();

  /* ── Brand-allowed category IDs (fetched when brandId changes) ─────────── */
  const [brandAllowedCategoryIds, setBrandAllowedCategoryIds] = useState<
    Set<string>
  >(new Set());
  const fetchedBrandIdRef = useRef<string>("");

  /* ── Left panel state ──────────────────────────────────────────────────── */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [isIndicativePrice, setIsIndicativePrice] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountPrice, setDiscountPrice] = useState("");
  const [stockStatus, setStockStatus] = useState<"in_stock" | "by_importation">(
    "in_stock",
  );
  const [keyCharacteristics, setKeyCharacteristics] = useState("");
  const [productInfo, setProductInfo] = useState("");
  const [sendPolicy, setSendPolicy] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [deliveryEstimate, setDeliveryEstimate] = useState("");
  const [supplierLink, setSupplierLink] = useState("");
  const [isListed, setIsListed] = useState(true);
  const [status, setStatus] = useState<"draft" | "published">("draft");

  /* ── Right panel state ─────────────────────────────────────────────────── */
  const [mainMedia, setMainMedia] = useState<MediaDraft[]>([]);
  const [brandId, setBrandId] = useState("");
  const [selectedL0Ids, setSelectedL0Ids] = useState<string[]>([]);
  const [selectedL1Ids, setSelectedL1Ids] = useState<string[]>([]);
  const [selectedL2Ids, setSelectedL2Ids] = useState<string[]>([]);
  const [sizeGuideId, setSizeGuideId] = useState("");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  /** The color whose panel is currently visible */
  const [activeColorId, setActiveColorId] = useState<string | null>(null);
  const [colorMedia, setColorMedia] = useState<Record<string, MediaDraft[]>>(
    {},
  );
  /** Cache color name/hex for swatch rendering (populated from initial fetch + search) */
  const [colorInfoMap, setColorInfoMap] = useState<
    Record<string, { name: string; hexCode: string }>
  >({});
  /** Cache size name/label (populated from sizesData) */
  const [sizeInfoMap, setSizeInfoMap] = useState<
    Record<string, { name: string; label: string }>
  >({});
  /** Which sizes are active per color: Record<colorId, sizeId[]> */
  const [selectedSizesByColor, setSelectedSizesByColor] = useState<
    Record<string, string[]>
  >({});
  /** Variant field configs per (colorId, sizeId) */
  const [variantMap, setVariantMap] = useState<
    Record<string, Record<string, VariantConfig>>
  >({});

  /* Sizes for the selected categories (deduplicated by API) */
  const allSelectedCatIds = useMemo(
    () => [...selectedL0Ids, ...selectedL1Ids, ...selectedL2Ids],
    [selectedL0Ids, selectedL1Ids, selectedL2Ids],
  );
  const { data: sizesData } = useSizes({
    categoryIds: allSelectedCatIds.length > 0 ? allSelectedCatIds : undefined,
    limit: 100,
  });

  /* ── Extra sections (local state) ─────────────────────────────────────── */
  const [filterAssignments, setFilterAssignments] = useState<
    FilterAssignment[]
  >([]);
  /** Accumulated list of all filters fetched (handles API limit=100 pagination) */
  const [allFilters, setAllFilters] = useState<Filter[]>([]);
  const [l0FilterId, setL0FilterId] = useState("");
  const [l1FilterId, setL1FilterId] = useState("");
  const [l2FilterId, setL2FilterId] = useState("");
  const [l0FilterValueIds, setL0FilterValueIds] = useState<string[]>([]);
  const [l1FilterValueIds, setL1FilterValueIds] = useState<string[]>([]);
  const [l2FilterValueIds, setL2FilterValueIds] = useState<string[]>([]);

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [financialLoaded, setFinancialLoaded] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [confirmDeleteSupplier, setConfirmDeleteSupplier] = useState<
    number | null
  >(null);
  const [confirmDeleteCompetitor, setConfirmDeleteCompetitor] = useState<
    number | null
  >(null);
  const [pendingDeleteSupplierIds, setPendingDeleteSupplierIds] = useState<
    string[]
  >([]);
  const [pendingDeleteCompetitorIds, setPendingDeleteCompetitorIds] = useState<
    string[]
  >([]);

  /* ── Init from product ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setDescription(product.description ?? "");
    setBasePrice(String(product.basePrice));
    setIsIndicativePrice(product.isIndicativePrice);
    setHasDiscount(product.hasDiscount);
    setDiscountPrice(
      product.discountPrice ? String(product.discountPrice) : "",
    );
    setStockStatus(product.stockStatus);
    setKeyCharacteristics(product.keyCharacteristics ?? "");
    setProductInfo(product.productInfo ?? "");
    setSendPolicy(product.sendPolicy ?? "");
    setReturnPolicy(product.returnPolicy ?? "");
    setDeliveryEstimate(product.deliveryEstimate ?? "");
    setSupplierLink(
      (product as unknown as { supplierLink?: string }).supplierLink ?? "",
    );
    setIsListed(product.isVisible);
    setStatus(product.status === "archived" ? "draft" : product.status);
    setBrandId(product.brandId);
    setSizeGuideId(product.sizeGuideId ?? "");

    // Collections: multi-select
    setCollectionIds(product.collections.map((c) => c.collectionId));

    // Categories by level
    const allCatIds = product.categories.map((c) => c.categoryId);
    const allCats = [...(l0Cats ?? []), ...(l1Cats ?? []), ...(l2Cats ?? [])];
    setSelectedL0Ids(
      allCats
        .filter((c) => c.level === 0 && allCatIds.includes(c.id))
        .map((c) => c.id),
    );
    setSelectedL1Ids(
      allCats
        .filter((c) => c.level === 1 && allCatIds.includes(c.id))
        .map((c) => c.id),
    );
    setSelectedL2Ids(
      allCats
        .filter((c) => c.level === 2 && allCatIds.includes(c.id))
        .map((c) => c.id),
    );

    // Media
    const noColor = product.media.filter((m) => !m.colorId);
    setMainMedia(
      noColor.map((m) => ({
        id: m.id,
        url: m.url,
        mediaType: m.mediaType,
        isPrimary: m.isPrimary,
        colorId: null,
      })),
    );

    // Color state
    const withColor = product.media.filter((m) => m.colorId);
    const newColorMedia: Record<string, MediaDraft[]> = {};
    for (const m of withColor) {
      const cid = m.colorId!;
      if (!newColorMedia[cid]) newColorMedia[cid] = [];
      newColorMedia[cid]!.push({
        id: m.id,
        url: m.url,
        mediaType: m.mediaType,
        isPrimary: m.isPrimary,
        colorId: cid,
      });
    }
    setColorMedia(newColorMedia);

    // Merge color IDs from variants AND media (a color may have images but no sizes yet)
    const variantColorIds = Array.from(
      new Set(product.variants.map((v) => v.colorId)),
    );
    const mediaColorIds = Array.from(
      new Set(
        product.media.filter((m) => m.colorId).map((m) => m.colorId as string),
      ),
    );
    const allColorIds = Array.from(
      new Set([...variantColorIds, ...mediaColorIds]),
    );
    if (allColorIds.length > 0) {
      setSelectedColorIds(allColorIds);
      setActiveColorId(allColorIds[0]!);
    }

    // Populate colorInfoMap from variant color objects
    setColorInfoMap((prev) => {
      const next = { ...prev };
      for (const v of product.variants) {
        if (v.color)
          next[v.colorId] = { name: v.color.name, hexCode: v.color.hexCode };
      }
      return next;
    });

    // Populate sizeInfoMap from variant size objects
    setSizeInfoMap((prev) => {
      const next = { ...prev };
      for (const v of product.variants) {
        if (v.size) next[v.sizeId] = { name: v.size.name, label: v.size.label };
      }
      return next;
    });

    // Init variant map and selectedSizesByColor from existing variants
    const newVariantMap: Record<string, Record<string, VariantConfig>> = {};
    const newSizesByColor: Record<string, string[]> = {};
    for (const v of product.variants) {
      if (!newVariantMap[v.colorId]) newVariantMap[v.colorId] = {};
      newVariantMap[v.colorId]![v.sizeId] = {
        stockQuantity: String(v.stockQuantity),
        price: v.price != null ? String(v.price) : "",
        hasDiscount: v.hasDiscount,
        discountPrice: v.discountPrice != null ? String(v.discountPrice) : "",
        isIndicativePrice: v.isIndicativePrice,
        position: String(v.position),
      };
      if (!newSizesByColor[v.colorId]) newSizesByColor[v.colorId] = [];
      if (!newSizesByColor[v.colorId]!.includes(v.sizeId))
        newSizesByColor[v.colorId]!.push(v.sizeId);
    }
    setVariantMap(newVariantMap);
    setSelectedSizesByColor(newSizesByColor);
  }, [product, l0Cats, l1Cats, l2Cats]);

  /* Ref mirror of colorInfoMap — lets the missing-color effect read current
     map state without adding colorInfoMap as a dependency (avoids re-loops). */
  const colorInfoMapRef = useRef(colorInfoMap);
  useEffect(() => {
    colorInfoMapRef.current = colorInfoMap;
  });
  const fetchingColorIdsRef = useRef(new Set<string>());

  /* Fetch color info for any selectedColorIds not yet in colorInfoMap.
     Guards against stale react-query cache where v.color may be absent. */
  useEffect(() => {
    const missing = selectedColorIds.filter(
      (id) =>
        !colorInfoMapRef.current[id] && !fetchingColorIdsRef.current.has(id),
    );
    if (missing.length === 0) return;
    for (const id of missing) fetchingColorIdsRef.current.add(id);
    (async () => {
      for (const id of missing) {
        try {
          const c = await apiFetch<{
            id: string;
            name: string;
            hexCode: string;
          }>(`/admin/colors/${id}`);
          setColorInfoMap((prev) => ({
            ...prev,
            [id]: { name: c.name, hexCode: c.hexCode },
          }));
        } catch {
          fetchingColorIdsRef.current.delete(id);
        }
      }
    })();
  }, [selectedColorIds]);

  /* Populate colorInfoMap whenever initial colors load */
  useEffect(() => {
    if (!colorsData?.items) return;
    setColorInfoMap((prev) => {
      const next = { ...prev };
      for (const c of colorsData.items)
        next[c.id] = { name: c.name, hexCode: c.hexCode };
      return next;
    });
  }, [colorsData]);

  /* Fetch brand's allowed category IDs whenever brandId changes */
  useEffect(() => {
    if (!brandId) {
      fetchedBrandIdRef.current = "";
      setBrandAllowedCategoryIds(new Set());
      return;
    }
    if (fetchedBrandIdRef.current === brandId) return;
    fetchedBrandIdRef.current = brandId;
    apiFetch<{ brandCategories: { category: { id: string } }[] }>(
      `/admin/brands/${brandId}`,
    )
      .then((b) => {
        setBrandAllowedCategoryIds(
          new Set(b.brandCategories.map((bc) => bc.category.id)),
        );
      })
      .catch(() => {
        setBrandAllowedCategoryIds(new Set());
      });
  }, [brandId]);

  /* Populate sizeInfoMap whenever sizes load */
  useEffect(() => {
    if (!sizesData?.items) return;
    setSizeInfoMap((prev) => {
      const next = { ...prev };
      for (const s of sizesData.items)
        next[s.id] = { name: s.name, label: s.label };
      return next;
    });
  }, [sizesData]);

  /* Load financial data (suppliers + competitors) once after product loads */
  useEffect(() => {
    if (!product || financialLoaded) return;
    setFinancialLoaded(true);
    apiFetch<{
      suppliers: {
        id: string;
        supplierName: string;
        supplierLink: string | null;
        address: string | null;
        contact: string | null;
        supplierPrice: string;
        priceWithDelivery: string;
        currencyRateId: string | null;
        deliveryTax: string;
        otherCosts: string;
        proposedPrice: string | null;
      }[];
      competitors: {
        id: string;
        link: string | null;
        price: number | string;
        comments: string | null;
      }[];
    }>(`/admin/products/${id}/financial`)
      .then(({ suppliers: rows, competitors: compRows }) => {
        if (rows.length > 0) {
          setSuppliers(
            rows.map((s) => ({
              id: s.id,
              dbId: s.id,
              supplierName: s.supplierName,
              supplierLink: s.supplierLink ?? "",
              address: s.address ?? "",
              contact: s.contact ?? "",
              supplierPrice: String(s.supplierPrice),
              priceWithDelivery: String(s.priceWithDelivery),
              currencyRateId: s.currencyRateId ?? "",
              deliveryTax: String(s.deliveryTax),
              otherCosts: String(s.otherCosts),
              proposedPrice: s.proposedPrice ? String(s.proposedPrice) : "",
            })),
          );
        }
        if (compRows && compRows.length > 0) {
          setCompetitors(
            compRows.map((c) => ({
              id: c.id,
              dbId: c.id,
              name: (c as unknown as { name?: string | null }).name ?? "",
              link: c.link ?? "",
              price: String(c.price),
              comment: c.comments ?? "",
            })),
          );
        }
      })
      .catch(() => {});
  }, [product, id, financialLoaded]);

  /* Populate sizeInfoMap whenever sizes load */
  useEffect(() => {
    if (!sizesData?.items) return;
    setSizeInfoMap((prev) => {
      const next = { ...prev };
      for (const s of sizesData.items)
        next[s.id] = { name: s.name, label: s.label };
      return next;
    });
  }, [sizesData]);

  /* Fetch all filters — paginate past the API max of 100 per page */
  useEffect(() => {
    if (!filtersPage1) return;
    const { items, total } = filtersPage1;
    if (total <= 100) {
      setAllFilters(items);
      return;
    }
    const totalPages = Math.ceil(total / 100);
    const extraPages = Array.from({ length: totalPages - 1 }, (_, i) =>
      apiFetch<{ items: Filter[] }>(`/admin/filters?page=${i + 2}&limit=100`),
    );
    Promise.all(extraPages)
      .then((results) =>
        setAllFilters([...items, ...results.flatMap((r) => r.items)]),
      )
      .catch(() => setAllFilters(items));
  }, [filtersPage1]);

  /* Restore filterAssignments from product.attributes once allFilters is loaded */
  useEffect(() => {
    if (!product || allFilters.length === 0) return;
    if (!product.attributes || product.attributes.length === 0) return;

    // Group option IDs by filterId (attributeDefinitionId)
    const grouped = new Map<string, string[]>();
    for (const a of product.attributes) {
      const list = grouped.get(a.attributeDefinitionId) ?? [];
      list.push(a.attributeOptionId);
      grouped.set(a.attributeDefinitionId, list);
    }

    const restored: FilterAssignment[] = [];
    for (const [filterId, optionIds] of grouped.entries()) {
      const filter = allFilters.find((f) => f.id === filterId);
      if (!filter) continue;
      const values = filter.options
        .filter((o) => optionIds.includes(o.id))
        .map((o) => ({ id: o.id, label: o.label, value: o.value }));
      if (values.length > 0) {
        // categoryLevel is not used for display (eligibility sets determine column)
        restored.push({
          filterId,
          filterName: filter.name,
          categoryLevel: "L0",
          values,
        });
      }
    }
    if (restored.length > 0) setFilterAssignments(restored);
  }, [product, allFilters]);

  /* ── Computed category options ─────────────────────────────────────────── */
  const l0Options = useMemo(() => {
    const hasBrandFilter = brandId && brandAllowedCategoryIds.size > 0;
    const allowed = (l0Cats ?? []).filter(
      (c) => !hasBrandFilter || brandAllowedCategoryIds.has(c.id),
    );
    const disabled = (l0Cats ?? []).filter(
      (c) => hasBrandFilter && !brandAllowedCategoryIds.has(c.id),
    );
    return [
      ...allowed.map((c) => ({ value: c.id, label: c.name })),
      ...disabled.map((c) => ({
        value: c.id,
        label: c.name,
        disabled: true,
        hint: "Não vendido por esta marca",
      })),
    ];
  }, [l0Cats, brandId, brandAllowedCategoryIds]);

  const l1Options = useMemo(() => {
    const l0Map = Object.fromEntries((l0Cats ?? []).map((c) => [c.id, c.name]));
    const hasBrandFilter = brandId && brandAllowedCategoryIds.size > 0;
    const filtered = (l1Cats ?? []).filter(
      (c) =>
        selectedL0Ids.length === 0 || selectedL0Ids.includes(c.parentId ?? ""),
    );
    const toOption = (c: (typeof filtered)[number]) => ({
      value: c.id,
      label:
        c.parentId && l0Map[c.parentId]
          ? `${c.name} (${l0Map[c.parentId]})`
          : c.name,
    });
    const allowed = filtered.filter(
      (c) => !hasBrandFilter || brandAllowedCategoryIds.has(c.id),
    );
    const disabledItems = filtered.filter(
      (c) => hasBrandFilter && !brandAllowedCategoryIds.has(c.id),
    );
    return [
      ...allowed.map(toOption),
      ...disabledItems.map((c) => ({
        ...toOption(c),
        disabled: true,
        hint: "Não vendido por esta marca",
      })),
    ];
  }, [l1Cats, l0Cats, selectedL0Ids, brandId, brandAllowedCategoryIds]);

  const l2Options = useMemo(() => {
    const l1Map = Object.fromEntries((l1Cats ?? []).map((c) => [c.id, c.name]));
    return (l2Cats ?? [])
      .filter(
        (c) =>
          selectedL1Ids.length === 0 ||
          selectedL1Ids.includes(c.parentId ?? ""),
      )
      .map((c) => ({
        value: c.id,
        label:
          c.parentId && l1Map[c.parentId]
            ? `${c.name} (${l1Map[c.parentId]})`
            : c.name,
      }));
  }, [l2Cats, l1Cats, selectedL1Ids]);

  const brandOptions = (brandsData?.items ?? []).map((b) => ({
    value: b.id,
    label: b.name,
  }));
  const sizeGuideOptions = (sizeGuidesData?.items ?? []).map((g) => ({
    value: g.id,
    label: g.name,
  }));
  const collectionOptions = (collectionsData?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const colorOptions = (colorsData?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    meta: c.hexCode,
  }));

  /* ── Filters per category level (with cross-level deduplication) ─────── */
  // L0: all filters linked to any selected L0 category — fully selectable
  const l0FiltersRaw = allFilters.filter(
    (f) =>
      selectedL0Ids.length > 0 &&
      f.categories.some((c) => selectedL0Ids.includes(c.categoryId)),
  );
  const l0FilterIdSet = new Set(l0FiltersRaw.map((f) => f.id));

  // L1: filters linked to selected L1 categories; those also in L0 are disabled
  const l1FiltersRaw = allFilters.filter(
    (f) =>
      selectedL1Ids.length > 0 &&
      f.categories.some((c) => selectedL1Ids.includes(c.categoryId)),
  );
  const l1FilterIdSet = new Set(l1FiltersRaw.map((f) => f.id));

  // L2: filters linked to selected L2 categories; those in L0 or L1 are disabled
  const l2FiltersRaw = allFilters.filter(
    (f) =>
      selectedL2Ids.length > 0 &&
      f.categories.some((c) => selectedL2Ids.includes(c.categoryId)),
  );

  const l0FilterOptions = l0FiltersRaw.map((f) => ({
    value: f.id,
    label: f.name,
    hint: f.isActive ? undefined : "Inactivo — não visível no portal",
  }));

  const l1FilterOptions = [
    ...l1FiltersRaw
      .filter((f) => !l0FilterIdSet.has(f.id))
      .map((f) => ({
        value: f.id,
        label: f.name,
        hint: f.isActive ? undefined : "Inactivo — não visível no portal",
      })),
    ...l1FiltersRaw
      .filter((f) => l0FilterIdSet.has(f.id))
      .map((f) => ({
        value: f.id,
        label: f.name,
        disabled: true,
        hint: "Já disponível na categoria principal",
      })),
  ];

  const l2FilterOptions = [
    ...l2FiltersRaw
      .filter((f) => !l0FilterIdSet.has(f.id) && !l1FilterIdSet.has(f.id))
      .map((f) => ({
        value: f.id,
        label: f.name,
        hint: f.isActive ? undefined : "Inactivo — não visível no portal",
      })),
    ...l2FiltersRaw
      .filter((f) => l0FilterIdSet.has(f.id) || l1FilterIdSet.has(f.id))
      .map((f) => ({
        value: f.id,
        label: f.name,
        disabled: true,
        hint: l0FilterIdSet.has(f.id)
          ? "Já disponível na categoria principal"
          : "Já disponível na categoria secundária",
      })),
  ];

  const l0ValueOptions =
    allFilters
      .find((f) => f.id === l0FilterId)
      ?.options.map((o) => ({ value: o.id, label: o.label })) ?? [];
  const l1ValueOptions =
    allFilters
      .find((f) => f.id === l1FilterId)
      ?.options.map((o) => ({ value: o.id, label: o.label })) ?? [];
  const l2ValueOptions =
    allFilters
      .find((f) => f.id === l2FilterId)
      ?.options.map((o) => ({ value: o.id, label: o.label })) ?? [];

  /* ── Color helpers ─────────────────────────────────────────────────────── */
  function toggleColor(cid: string) {
    if (!canEditProduct) return;

    if (selectedColorIds.includes(cid)) {
      // Removing: confirm first
      const colorName = colorInfoMap[cid]?.name ?? "esta cor";
      if (
        !window.confirm(
          `Remover "${colorName}"? As imagens e variantes desta cor serão eliminadas.`,
        )
      )
        return;
      const next = selectedColorIds.filter((x) => x !== cid);
      setSelectedColorIds(next);
      if (activeColorId === cid) {
        setActiveColorId(next.length > 0 ? next[0]! : null);
      }
    } else {
      // Adding: make the new color active
      setSelectedColorIds((prev) => [...prev, cid]);
      setActiveColorId(cid);
      setColorMedia((prev) => ({ ...prev, [cid]: prev[cid] ?? [] }));
    }
  }

  /* ── Variant helpers ───────────────────────────────────────────────────── */
  function setVariantField(
    cid: string,
    sid: string,
    field: keyof VariantConfig,
    value: string | boolean,
  ) {
    if (!canEditProduct) return;

    setVariantMap((prev) => ({
      ...prev,
      [cid]: {
        ...(prev[cid] ?? {}),
        [sid]: {
          ...(prev[cid]?.[sid] ?? defaultVariantConfig()),
          [field]: value,
        },
      },
    }));
  }

  /* ── Filter helpers ────────────────────────────────────────────────────── */
  function addFilterAssignment() {
    if (!canEditProduct) return;

    const newAssignments: FilterAssignment[] = [];

    if (l0FilterId && l0FilterValueIds.length > 0) {
      const filter = allFilters.find((f) => f.id === l0FilterId);
      if (filter) {
        const values = filter.options
          .filter((o) => l0FilterValueIds.includes(o.id))
          .map((o) => ({ id: o.id, label: o.label, value: o.value }));
        newAssignments.push({
          filterId: l0FilterId,
          filterName: filter.name,
          categoryLevel: "L0",
          values,
        });
      }
    }

    if (l1FilterId && l1FilterValueIds.length > 0) {
      const filter = allFilters.find((f) => f.id === l1FilterId);
      if (filter) {
        const values = filter.options
          .filter((o) => l1FilterValueIds.includes(o.id))
          .map((o) => ({ id: o.id, label: o.label, value: o.value }));
        newAssignments.push({
          filterId: l1FilterId,
          filterName: filter.name,
          categoryLevel: "L1",
          values,
        });
      }
    }

    if (l2FilterId && l2FilterValueIds.length > 0) {
      const filter = allFilters.find((f) => f.id === l2FilterId);
      if (filter) {
        const values = filter.options
          .filter((o) => l2FilterValueIds.includes(o.id))
          .map((o) => ({ id: o.id, label: o.label, value: o.value }));
        newAssignments.push({
          filterId: l2FilterId,
          filterName: filter.name,
          categoryLevel: "L2",
          values,
        });
      }
    }

    if (newAssignments.length === 0) return;

    setFilterAssignments((prev) => {
      let next = [...prev];
      for (const a of newAssignments) {
        // Keyed by filterId only — a filter can only be in one column due to dedup
        const idx = next.findIndex((x) => x.filterId === a.filterId);
        if (idx >= 0) {
          next[idx] = { ...next[idx]!, values: a.values };
        } else {
          next.push(a);
        }
      }
      return next;
    });

    setL0FilterId("");
    setL0FilterValueIds([]);
    setL1FilterId("");
    setL1FilterValueIds([]);
    setL2FilterId("");
    setL2FilterValueIds([]);
  }

  /* ── Supplier helpers ──────────────────────────────────────────────────── */
  function updateSupplier(idx: number, field: keyof SupplierRow, val: string) {
    if (!canEditProduct) return;

    setSuppliers((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    );
  }

  function removeSupplier(idx: number) {
    if (!canEditProduct) return;

    const row = suppliers[idx]!;
    setPendingDeleteSupplierIds((prev) => [...prev, row.id]);
    setConfirmDeleteSupplier(null);
  }

  /* ── Competitor helpers ────────────────────────────────────────────────── */
  function updateCompetitor(
    idx: number,
    field: keyof CompetitorEntry,
    val: string,
  ) {
    if (!canEditProduct) return;

    setCompetitors((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    );
  }

  function removeCompetitor(idx: number) {
    if (!canEditProduct) return;

    const row = competitors[idx]!;
    setPendingDeleteCompetitorIds((prev) => [...prev, row.id]);
    setConfirmDeleteCompetitor(null);
  }

  /* ── Save ──────────────────────────────────────────────────────────────── */
  async function handleSave(publish = false) {
    if (!canEditProduct) {
      toast.error("A sua role não pode editar este produto.");
      return;
    }

    if (!name.trim()) return toast.error("O nome é obrigatório");
    if (!brandId) return toast.error("A marca é obrigatória");

    const bp = parseFloat(basePrice);
    if (isNaN(bp) || bp < 0) return toast.error("Preço base inválido");

    const allMedia = [
      ...mainMedia.filter((m) => !m.uploading && m.url),
      ...selectedColorIds.flatMap((cid) =>
        (colorMedia[cid] ?? []).filter((m) => !m.uploading && m.url),
      ),
    ].map((m, i) => ({
      url: m.url,
      mediaType: m.mediaType,
      colorId: m.colorId ?? undefined,
      isPrimary: m.isPrimary,
      position: i,
    }));

    const payload = {
      name: name.trim(),
      slug: slugify(name.trim()),
      description: description || undefined,
      brandId,
      basePrice: bp,
      isIndicativePrice,
      hasDiscount,
      discountPrice:
        hasDiscount && discountPrice ? parseFloat(discountPrice) : undefined,
      stockStatus,
      status: (publish ? "published" : status) as "draft" | "published",
      isVisible: isListed,
      keyCharacteristics: keyCharacteristics || undefined,
      productInfo: productInfo || undefined,
      sendPolicy: sendPolicy || undefined,
      returnPolicy: returnPolicy || undefined,
      deliveryEstimate: deliveryEstimate || undefined,
      sizeGuideId: sizeGuideId || undefined,
      categoryIds: [...selectedL0Ids, ...selectedL1Ids, ...selectedL2Ids],
      collectionIds: collectionIds,
      media: allMedia,
      attributes: filterAssignments
        .filter((a) =>
          [...l0FiltersRaw, ...l1FiltersRaw, ...l2FiltersRaw].some(
            (f) => f.id === a.filterId,
          ),
        )
        .reduce(
          (
            acc: {
              attributeDefinitionId: string;
              attributeOptionIds: string[];
            }[],
            a,
          ) => {
            const existing = acc.find(
              (x) => x.attributeDefinitionId === a.filterId,
            );
            if (existing) {
              existing.attributeOptionIds.push(...a.values.map((v) => v.id));
            } else {
              acc.push({
                attributeDefinitionId: a.filterId,
                attributeOptionIds: a.values.map((v) => v.id),
              });
            }
            return acc;
          },
          [],
        ),
      sizeIds: Array.from(new Set(Object.values(selectedSizesByColor).flat())),
      variants: selectedColorIds.flatMap((cid) =>
        (selectedSizesByColor[cid] ?? []).map((sid, idx) => {
          const cfg = variantMap[cid]?.[sid] ?? defaultVariantConfig();
          return {
            colorId: cid,
            sizeId: sid,
            stockQuantity: parseInt(cfg.stockQuantity) || 0,
            price: cfg.price ? parseFloat(cfg.price) : undefined,
            hasDiscount: cfg.hasDiscount,
            discountPrice:
              cfg.hasDiscount && cfg.discountPrice
                ? parseFloat(cfg.discountPrice)
                : undefined,
            isIndicativePrice: cfg.isIndicativePrice,
            position: parseInt(cfg.position) || idx,
          };
        }),
      ),
    };

    try {
      await updateProduct.mutateAsync(payload);

      // Delete pending supplier removals
      for (const rowId of pendingDeleteSupplierIds) {
        const row = suppliers.find((r) => r.id === rowId);
        if (row?.dbId) {
          await apiFetch(`/admin/products/${id}/suppliers/${row.dbId}`, {
            method: "DELETE",
          });
        }
      }
      if (pendingDeleteSupplierIds.length > 0) {
        setSuppliers((prev) =>
          prev.filter((r) => !pendingDeleteSupplierIds.includes(r.id)),
        );
        setPendingDeleteSupplierIds([]);
      }

      // Delete pending competitor removals
      for (const rowId of pendingDeleteCompetitorIds) {
        const row = competitors.find((r) => r.id === rowId);
        if (row?.dbId) {
          await apiFetch(`/admin/products/${id}/competitors/${row.dbId}`, {
            method: "DELETE",
          });
        }
      }
      if (pendingDeleteCompetitorIds.length > 0) {
        setCompetitors((prev) =>
          prev.filter((r) => !pendingDeleteCompetitorIds.includes(r.id)),
        );
        setPendingDeleteCompetitorIds([]);
      }

      // Save supplier rows (POST new, PATCH existing)
      for (const row of suppliers.filter(
        (r) => !pendingDeleteSupplierIds.includes(r.id),
      )) {
        const isEmpty =
          !row.supplierName && !row.supplierPrice && !row.priceWithDelivery;
        if (isEmpty) continue;
        const supplierPayload = {
          supplierName: row.supplierName || "—",
          supplierLink: row.supplierLink || undefined,
          address: row.address || undefined,
          contact: row.contact || undefined,
          supplierPrice: parseFloat(row.supplierPrice) || 0,
          priceWithDelivery: parseFloat(row.priceWithDelivery) || 0,
          currencyRateId: row.currencyRateId || undefined,
          deliveryTax: parseFloat(row.deliveryTax) || 0,
          otherCosts: parseFloat(row.otherCosts) || 0,
          proposedPrice: row.proposedPrice
            ? parseFloat(row.proposedPrice)
            : undefined,
        };
        if (row.dbId) {
          await apiFetch(`/admin/products/${id}/suppliers/${row.dbId}`, {
            method: "PATCH",
            body: JSON.stringify(supplierPayload),
          });
        } else {
          const created = await apiFetch<{ id: string }>(
            `/admin/products/${id}/suppliers`,
            { method: "POST", body: JSON.stringify(supplierPayload) },
          );
          setSuppliers((prev) =>
            prev.map((r) => (r.id === row.id ? { ...r, dbId: created.id } : r)),
          );
        }
      }

      // Save competitor rows (POST new, PATCH existing)
      for (const comp of competitors.filter(
        (r) => !pendingDeleteCompetitorIds.includes(r.id),
      )) {
        const isEmpty = !comp.name && !comp.link && !comp.price;
        if (isEmpty) continue;
        const competitorPayload = {
          name: comp.name || undefined,
          link: comp.link || undefined,
          price: parseFloat(comp.price) || undefined,
          comments: comp.comment || undefined,
        };
        if (comp.dbId) {
          await apiFetch(`/admin/products/${id}/competitors/${comp.dbId}`, {
            method: "PATCH",
            body: JSON.stringify(competitorPayload),
          });
        } else {
          const created = await apiFetch<{ id: string }>(
            `/admin/products/${id}/competitors`,
            { method: "POST", body: JSON.stringify(competitorPayload) },
          );
          setCompetitors((prev) =>
            prev.map((r) =>
              r.id === comp.id ? { ...r, dbId: created.id } : r,
            ),
          );
        }
      }

      const reviewMode = publish && forcesHiddenProductSave(user);
      toast.success(
        reviewMode
          ? "Produto enviado para revisão"
          : publish
            ? "Produto publicado"
            : "Produto guardado",
      );
      if (publish) setStatus("published");
    } catch (err) {
      if (err instanceof ApiError) {
        const lines = [err.message];
        if (err.details && err.details.length > 0) {
          lines.push(...err.details.map((d) => `• ${d}`));
        }
        toast.error(lines.join("\n"));
      } else {
        toast.error(
          err instanceof Error ? err.message : "Erro ao guardar o produto",
        );
      }
    }
  }

  /* ── Loading / 404 ─────────────────────────────────────────────────────── */
  if (!allowProductView) {
    return (
      <AccessDeniedState message="A sua role não pode aceder aos produtos." />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="w-8 h-8 border-4 border-border border-t-navy rounded-full animate-spin" />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="p-10 text-center text-text-muted font-figtree">
        Produto não encontrado.
      </div>
    );
  }

  const totalStock = product.variants.reduce((s, v) => s + v.stockQuantity, 0);
  const isSoldOut = stockStatus === "in_stock" && totalStock === 0;
  const isPending = updateProduct.isPending;
  const canEditProduct = canEditSpecificProduct(user, product.isVisible);
  const reviewMode = forcesHiddenProductSave(user);
  const isUploading =
    mainMedia.some((m) => m.uploading) ||
    selectedColorIds.some((cid) =>
      (colorMedia[cid] ?? []).some((m) => m.uploading),
    );

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-5 pb-10">
      {!canEditProduct && (
        <div className="rounded-xl border border-border-light bg-card px-4 py-3 text-sm text-text-body font-figtree">
          Esta role pode ver o produto, mas não pode editá-lo no estado atual em
          que está listado.
        </div>
      )}

      {canEditProduct && reviewMode && (
        <div className="rounded-xl border border-border-light bg-card px-4 py-3 text-sm text-text-body font-figtree">
          As alterações desta role ficam ocultas no site e seguem para revisão
          antes da publicação final.
        </div>
      )}

      {/* ── Action buttons row ─────────────────────────────────────────── */}
      {canEditProduct ? (
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isPending || isUploading}
            onClick={() => handleSave(false)}
            className="flex items-center gap-2 h-12 px-5 rounded-xl border border-border-light text-text-dark text-sm font-semibold font-figtree hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <Save size={18} />
            {isUploading
              ? "A carregar imagens…"
              : isPending
                ? "A guardar…"
                : "Guardar rascunho"}
          </button>
          <button
            type="button"
            disabled={isPending || isUploading}
            onClick={() => handleSave(true)}
            className="h-12 px-6 rounded-xl bg-navy text-white text-sm font-semibold font-figtree hover:bg-primary transition-colors disabled:opacity-50"
          >
            {isUploading
              ? "A carregar…"
              : isPending
                ? "A publicar…"
                : "Publicar"}
          </button>
        </div>
      ) : null}

      <fieldset disabled={!canEditProduct} className="contents">
        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* ═══════════════════════ LEFT PANEL ═══════════════════════════ */}
          <div className="flex-1 w-full h-full min-w-0 bg-card rounded-2xl p-6 flex flex-col gap-7">
            {/* Detalhes do produto */}
            <div className="flex flex-col gap-5">
              <SectionHeading>Detalhes do produto</SectionHeading>
              <div>
                <FieldLabel>Nome</FieldLabel>
                <Input
                  value={name}
                  onChange={setName}
                  placeholder="Nome do produto"
                />
              </div>
              <div>
                <FieldLabel>Descrição</FieldLabel>
                <Textarea
                  value={description}
                  onChange={setDescription}
                  placeholder="Descreva o produto…"
                  rows={5}
                />
              </div>
            </div>

            {/* Precificação */}
            <div className="flex flex-col gap-5">
              <SectionHeading>Precificação</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Preço*</FieldLabel>
                  <Input
                    value={basePrice}
                    onChange={setBasePrice}
                    type="number"
                    placeholder="0"
                    suffix="Mzn"
                  />
                </div>
                <div>
                  <FieldLabel>Preço indicativo</FieldLabel>
                  <div className="flex items-center h-12">
                    <Toggle
                      label=""
                      value={isIndicativePrice}
                      onChange={setIsIndicativePrice}
                      orientation="horizontal"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Preço de desconto (Opcional)</FieldLabel>
                  <Input
                    value={discountPrice}
                    onChange={setDiscountPrice}
                    type="number"
                    placeholder="0"
                    disabled={!hasDiscount}
                  />
                </div>
                <div>
                  <FieldLabel>Preço desconto</FieldLabel>
                  <div className="flex items-center h-12">
                    <Toggle
                      label=""
                      value={hasDiscount}
                      onChange={setHasDiscount}
                      orientation="horizontal"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Inventário */}
            <div className="flex flex-col gap-5">
              <SectionHeading>Inventário</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Estado de stock</FieldLabel>
                  <SearchableSelect
                    value={stockStatus}
                    onChange={(v) =>
                      setStockStatus(v as "in_stock" | "by_importation")
                    }
                    options={[
                      { value: "in_stock", label: "Em stock" },
                      { value: "by_importation", label: "Por importação" },
                    ]}
                  />
                </div>
                <div>
                  <FieldLabel>Quantidade de stock</FieldLabel>
                  <div className="flex items-center h-12 px-3 rounded-xl border border-border bg-surface-hover text-text-dark text-sm font-inter">
                    {totalStock}
                  </div>
                </div>
              </div>
            </div>

            {/* Informações importantes */}
            <div className="flex flex-col gap-5">
              <SectionHeading>Informações importantes</SectionHeading>
              <div>
                <FieldLabel>Características-chave</FieldLabel>
                <Textarea
                  value={keyCharacteristics}
                  onChange={setKeyCharacteristics}
                  placeholder="Características principais do produto…"
                  rows={5}
                />
              </div>
              <div>
                <FieldLabel>Informações</FieldLabel>
                <Textarea
                  value={productInfo}
                  onChange={setProductInfo}
                  placeholder="Detalhes técnicos, materiais, cuidados…"
                  rows={5}
                />
              </div>
              <div>
                <FieldLabel>Política de envio</FieldLabel>
                <Textarea
                  value={sendPolicy}
                  onChange={setSendPolicy}
                  placeholder="A sua política de envio ficará aqui…"
                  rows={2}
                />
              </div>
              <div>
                <FieldLabel>Política de devolução</FieldLabel>
                <Textarea
                  value={returnPolicy}
                  onChange={setReturnPolicy}
                  placeholder="A sua política de devolução ficará aqui…"
                  rows={2}
                />
              </div>
              <div>
                <FieldLabel>Estimativa de entrega</FieldLabel>
                <Input
                  value={deliveryEstimate}
                  onChange={setDeliveryEstimate}
                  placeholder="Ex: 3 a 4 dias úteis"
                />
              </div>
              <div>
                <FieldLabel>Link do fornecedor</FieldLabel>
                <Input
                  value={supplierLink}
                  onChange={setSupplierLink}
                  placeholder="O link ficará aqui"
                />
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isListed}
                    onChange={(e) => setIsListed(e.target.checked)}
                    disabled={reviewMode}
                    className="w-5 h-5 rounded border-border accent-navy cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span className="text-s font-figtree text-text-dark">
                    {reviewMode ? "Oculto até revisão" : "Listar produto"}
                  </span>
                </label>
                <label className="flex items-center gap-2 select-none">
                  <input
                    type="checkbox"
                    checked={isSoldOut}
                    readOnly
                    className="w-5 h-5 rounded border-border accent-navy cursor-default"
                  />
                  <span className="text-s font-figtree text-text-muted">
                    Sold out
                  </span>
                </label>
              </div>
            </div>
          </div>
          {/* END LEFT PANEL */}

          {/* ═══════════════════════ RIGHT PANEL ══════════════════════════ */}
          <div className="w-full lg:w-121.25 shrink-0 bg-card rounded-2xl p-6 flex flex-col gap-7">
            {/* Imagem do produto */}
            <div className="flex flex-col gap-4">
              <SectionHeading>Imagem do produto</SectionHeading>
              <div>
                <FieldLabel>Imagem principal</FieldLabel>
                <ProductMediaZone
                  items={mainMedia}
                  onChange={setMainMedia}
                  colorId={null}
                  context="product"
                />
              </div>
            </div>

            {/* Marca, categoria e tamanhos */}
            <div className="flex flex-col gap-4">
              <SectionHeading>Marca, categoria e tamanhos</SectionHeading>
              <div>
                <FieldLabel>Marca</FieldLabel>
                <ApiSearchSelect
                  value={brandId}
                  onChange={setBrandId}
                  options={brandOptions}
                  onSearch={async (q) => {
                    const res = await apiFetch<{
                      items: { id: string; name: string }[];
                    }>(
                      `/admin/brands?search=${encodeURIComponent(q)}&limit=20`,
                    );
                    return res.items.map((b) => ({
                      value: b.id,
                      label: b.name,
                    }));
                  }}
                  placeholder="Selecione a marca"
                  clearable
                />
              </div>
              <div>
                <FieldLabel>Categoria principal</FieldLabel>
                <MultiSelectDropdown
                  label=""
                  options={l0Options}
                  selected={selectedL0Ids}
                  onChange={(ids) => {
                    setSelectedL0Ids(ids);
                    // Keep L1 selections whose parent is still selected
                    const nextL1 = selectedL1Ids.filter((l1Id) => {
                      const cat = (l1Cats ?? []).find((c) => c.id === l1Id);
                      return cat ? ids.includes(cat.parentId ?? "") : false;
                    });
                    setSelectedL1Ids(nextL1);
                    // Keep L2 selections whose parent is in retained L1
                    const nextL1Set = new Set(nextL1);
                    setSelectedL2Ids((prev) =>
                      prev.filter((l2Id) => {
                        const cat = (l2Cats ?? []).find((c) => c.id === l2Id);
                        return cat ? nextL1Set.has(cat.parentId ?? "") : false;
                      }),
                    );
                    setL0FilterId("");
                    setL0FilterValueIds([]);
                    setL1FilterId("");
                    setL1FilterValueIds([]);
                    setL2FilterId("");
                    setL2FilterValueIds([]);
                  }}
                  placeholder="Selecione as categorias principais"
                  searchable
                />
                {selectedL0Ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {l0Options
                      .filter((o) => selectedL0Ids.includes(o.value))
                      .map((opt) => (
                        <span
                          key={opt.value}
                          className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-figtree px-2.5 py-1 rounded-full"
                        >
                          {opt.label}
                          <button
                            type="button"
                            onClick={() => {
                              const nextL0 = selectedL0Ids.filter(
                                (x) => x !== opt.value,
                              );
                              setSelectedL0Ids(nextL0);
                              const nextL1 = selectedL1Ids.filter((l1Id) => {
                                const cat = (l1Cats ?? []).find(
                                  (c) => c.id === l1Id,
                                );
                                return cat
                                  ? nextL0.includes(cat.parentId ?? "")
                                  : false;
                              });
                              setSelectedL1Ids(nextL1);
                              const nextL1Set = new Set(nextL1);
                              setSelectedL2Ids((prev) =>
                                prev.filter((l2Id) => {
                                  const cat = (l2Cats ?? []).find(
                                    (c) => c.id === l2Id,
                                  );
                                  return cat
                                    ? nextL1Set.has(cat.parentId ?? "")
                                    : false;
                                }),
                              );
                            }}
                            className="ml-0.5 hover:opacity-70"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Sub categoria</FieldLabel>
                <MultiSelectDropdown
                  label=""
                  options={l1Options}
                  selected={selectedL1Ids}
                  onChange={(ids) => {
                    setSelectedL1Ids(ids);
                    // Keep L2 selections whose parent is still selected
                    const nextL1Set = new Set(ids);
                    setSelectedL2Ids((prev) =>
                      prev.filter((l2Id) => {
                        const cat = (l2Cats ?? []).find((c) => c.id === l2Id);
                        return cat ? nextL1Set.has(cat.parentId ?? "") : false;
                      }),
                    );
                    setL1FilterId("");
                    setL1FilterValueIds([]);
                    setL2FilterId("");
                    setL2FilterValueIds([]);
                  }}
                  placeholder={
                    selectedL0Ids.length > 0
                      ? "Selecione as subcategorias"
                      : "Selecione a categoria principal primeiro"
                  }
                  disabled={selectedL0Ids.length === 0}
                  searchable
                />
                {selectedL1Ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {l1Options
                      .filter((o) => selectedL1Ids.includes(o.value))
                      .map((opt) => (
                        <span
                          key={opt.value}
                          className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-figtree px-2.5 py-1 rounded-full"
                        >
                          {opt.label}
                          <button
                            type="button"
                            onClick={() => {
                              const nextL1 = selectedL1Ids.filter(
                                (x) => x !== opt.value,
                              );
                              setSelectedL1Ids(nextL1);
                              const nextL1Set = new Set(nextL1);
                              setSelectedL2Ids((prev) =>
                                prev.filter((l2Id) => {
                                  const cat = (l2Cats ?? []).find(
                                    (c) => c.id === l2Id,
                                  );
                                  return cat
                                    ? nextL1Set.has(cat.parentId ?? "")
                                    : false;
                                }),
                              );
                            }}
                            className="ml-0.5 hover:opacity-70"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Sub categoria mais íntima</FieldLabel>
                <MultiSelectDropdown
                  label=""
                  options={l2Options}
                  selected={selectedL2Ids}
                  onChange={(ids) => {
                    setSelectedL2Ids(ids);
                    setL2FilterId("");
                    setL2FilterValueIds([]);
                  }}
                  placeholder={
                    selectedL1Ids.length > 0
                      ? "Selecione as subcategorias íntimas"
                      : "Selecione a sub categoria primeiro"
                  }
                  disabled={selectedL1Ids.length === 0}
                  searchable
                />
                {selectedL2Ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {l2Options
                      .filter((o) => selectedL2Ids.includes(o.value))
                      .map((opt) => (
                        <span
                          key={opt.value}
                          className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-figtree px-2.5 py-1 rounded-full"
                        >
                          {opt.label}
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedL2Ids((p) =>
                                p.filter((x) => x !== opt.value),
                              )
                            }
                            className="ml-0.5 hover:opacity-70"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Guia de tamanho</FieldLabel>
                <ApiSearchSelect
                  value={sizeGuideId}
                  onChange={setSizeGuideId}
                  options={sizeGuideOptions}
                  onSearch={async (q) => {
                    const res = await apiFetch<{
                      items: { id: string; name: string }[];
                    }>(
                      `/admin/size-guides?search=${encodeURIComponent(q)}&limit=20`,
                    );
                    return res.items.map((g) => ({
                      value: g.id,
                      label: g.name,
                    }));
                  }}
                  placeholder="Selecione o guia"
                  clearable
                />
              </div>
              <div>
                <FieldLabel>Tendência</FieldLabel>
                <MultiSelectDropdown
                  label=""
                  options={collectionOptions}
                  selected={collectionIds}
                  onChange={setCollectionIds}
                  placeholder="Selecione as tendências"
                  searchable
                />
                {collectionIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {collectionOptions
                      .filter((o) => collectionIds.includes(o.value))
                      .map((opt) => (
                        <span
                          key={opt.value}
                          className="inline-flex items-center gap-1 bg-navy text-white text-[12px] font-figtree px-2.5 py-1 rounded-full"
                        >
                          {opt.label}
                          <button
                            type="button"
                            onClick={() =>
                              setCollectionIds((p) =>
                                p.filter((x) => x !== opt.value),
                              )
                            }
                            className="ml-0.5 hover:opacity-70"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cores */}
            <div className="flex flex-col gap-4">
              <SectionHeading>Cores</SectionHeading>

              {/* Color picker with search */}
              <div>
                <FieldLabel>Escolher cor</FieldLabel>
                <ApiSearchSelect
                  value=""
                  onChange={(v) => {
                    if (v) toggleColor(v);
                  }}
                  options={colorOptions.filter(
                    (o) => !selectedColorIds.includes(o.value),
                  )}
                  onSearch={async (q) => {
                    const res = await apiFetch<{
                      items: { id: string; name: string; hexCode: string }[];
                    }>(
                      `/admin/colors?search=${encodeURIComponent(q)}&limit=20`,
                    );
                    setColorInfoMap((prev) => {
                      const next = { ...prev };
                      for (const c of res.items)
                        next[c.id] = { name: c.name, hexCode: c.hexCode };
                      return next;
                    });
                    return res.items
                      .filter((c) => !selectedColorIds.includes(c.id))
                      .map((c) => ({
                        value: c.id,
                        label: c.name,
                        meta: c.hexCode,
                      }));
                  }}
                  placeholder="Pesquise e selecione as cores"
                />
              </div>

              {/* Color tabs — click to switch active, × to remove */}
              {selectedColorIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedColorIds.map((cid) => {
                    const color = colorInfoMap[cid];
                    if (!color) return null;
                    const isActive = activeColorId === cid;
                    return (
                      <button
                        key={cid}
                        type="button"
                        onClick={() => setActiveColorId(cid)}
                        className={`inline-flex items-center gap-2 px-3 h-9 rounded-xl border text-s font-figtree font-medium transition-all ${
                          isActive
                            ? "bg-navy border-navy text-white shadow-sm"
                            : "bg-card border-border text-text-dark hover:border-accent"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                          style={{ backgroundColor: color.hexCode }}
                        />
                        {color.name}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleColor(cid);
                          }}
                          className={`ml-0.5 flex items-center justify-center w-4 h-4 rounded-full transition-colors cursor-pointer ${
                            isActive
                              ? "hover:bg-white/20 text-white/80 hover:text-white"
                              : "hover:bg-surface-hover text-text-muted hover:text-danger"
                          }`}
                          title={`Remover ${color.name}`}
                        >
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 8 8"
                            fill="none"
                          >
                            <path
                              d="M1 1l6 6M7 1L1 7"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active color panel */}
              {activeColorId &&
                (() => {
                  const cid = activeColorId;
                  const color = colorInfoMap[cid];
                  if (!color) return null;
                  const colorSizeIds = selectedSizesByColor[cid] ?? [];
                  const availableSizes = sizesData?.items ?? [];
                  const sizeOptions = availableSizes.map((s) => ({
                    value: s.id,
                    label: s.label || s.name,
                  }));
                  return (
                    <div className="flex flex-col gap-5 p-4 rounded-2xl border border-border-light bg-card">
                      {/* Color header */}
                      <div className="flex items-center gap-2 pb-2 border-b border-border-light">
                        <span
                          className="w-5 h-5 rounded-full border border-border-light shrink-0 shadow-sm"
                          style={{ backgroundColor: color.hexCode }}
                        />
                        <span className="text-md font-bold text-navy font-lato">
                          {color.name}
                        </span>
                      </div>

                      {/* Media zone */}
                      <div>
                        <FieldLabel>Imagens e vídeos</FieldLabel>
                        <ProductMediaZone
                          items={colorMedia[cid] ?? []}
                          onChange={(items) =>
                            setColorMedia((prev) => ({ ...prev, [cid]: items }))
                          }
                          colorId={cid}
                          context="product"
                        />
                      </div>

                      {/* Tamanhos e variantes */}
                      <div className="flex flex-col gap-3">
                        <span className="text-s font-semibold text-text-dark font-figtree">
                          Tamanhos e variantes
                        </span>

                        {allSelectedCatIds.length === 0 ? (
                          <p className="text-s text-text-muted font-figtree italic">
                            Selecione categorias para ver os tamanhos
                            disponíveis.
                          </p>
                        ) : availableSizes.length === 0 ? (
                          <p className="text-s text-text-muted font-figtree italic">
                            Nenhum tamanho associado às categorias selecionadas.
                          </p>
                        ) : (
                          <MultiSelectDropdown
                            label=""
                            options={sizeOptions}
                            selected={colorSizeIds}
                            onChange={(ids) =>
                              setSelectedSizesByColor((prev) => ({
                                ...prev,
                                [cid]: ids,
                              }))
                            }
                            placeholder="Selecione os tamanhos para esta cor"
                            searchable
                          />
                        )}

                        {/* Variant config table */}
                        {colorSizeIds.length > 0 && (
                          <div className="mt-1 rounded-xl border border-border overflow-x-auto">
                            {/* Header */}
                            <div className="grid grid-cols-[80px_120px_72px_140px_140px_56px_72px] gap-0 bg-surface-hover border-b border-border min-w-[700px]">
                              {[
                                "Tamanho",
                                "Stock",
                                "Posição",
                                "Preço (MZN)",
                                "P. c/ desconto",
                                "Desc.",
                                "Indicativo",
                              ].map((h, i) => (
                                <div
                                  key={h}
                                  className={`px-3 py-2.5 text-xxs font-semibold text-text-table-head font-figtree uppercase tracking-wide ${i >= 5 ? "text-center" : ""}`}
                                >
                                  {h}
                                </div>
                              ))}
                            </div>
                            {/* Rows */}
                            {colorSizeIds.map((sid, rowIdx) => {
                              const sizeInfo = sizeInfoMap[sid];
                              const cfg =
                                variantMap[cid]?.[sid] ??
                                defaultVariantConfig();
                              const isEven = rowIdx % 2 === 0;
                              return (
                                <div
                                  key={sid}
                                  className={`grid grid-cols-[80px_120px_72px_140px_140px_56px_72px] gap-0 items-center border-b border-border last:border-b-0 transition-colors min-w-[700px] ${isEven ? "bg-card" : "bg-surface-hover/50"}`}
                                >
                                  {/* Size badge */}
                                  <div className="px-3 py-2.5">
                                    <span className="inline-flex items-center justify-center bg-navy text-white text-xxs font-bold font-inter rounded-lg px-2 py-1 min-w-[40px]">
                                      {sizeInfo?.label || sizeInfo?.name || "—"}
                                    </span>
                                  </div>
                                  {/* Stock */}
                                  <div className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={cfg.stockQuantity}
                                      onChange={(e) =>
                                        setVariantField(
                                          cid,
                                          sid,
                                          "stockQuantity",
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 w-full px-2 rounded-lg border border-border bg-card text-text-dark text-s font-inter focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
                                      placeholder="0"
                                    />
                                  </div>
                                  {/* Position */}
                                  <div className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={cfg.position}
                                      onChange={(e) =>
                                        setVariantField(
                                          cid,
                                          sid,
                                          "position",
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 w-full px-2 rounded-lg border border-border bg-card text-text-dark text-s font-inter focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
                                      placeholder="0"
                                    />
                                  </div>
                                  {/* Price */}
                                  <div className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={cfg.price}
                                      onChange={(e) =>
                                        setVariantField(
                                          cid,
                                          sid,
                                          "price",
                                          e.target.value,
                                        )
                                      }
                                      className="h-8 w-full px-2 rounded-lg border border-border bg-card text-text-dark text-s font-inter focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors"
                                      placeholder="—"
                                    />
                                  </div>
                                  {/* Discount price */}
                                  <div className="px-2 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={cfg.discountPrice}
                                      onChange={(e) =>
                                        setVariantField(
                                          cid,
                                          sid,
                                          "discountPrice",
                                          e.target.value,
                                        )
                                      }
                                      disabled={!cfg.hasDiscount}
                                      className="h-8 w-full px-2 rounded-lg border border-border bg-card text-text-dark text-s font-inter focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                      placeholder="—"
                                    />
                                  </div>
                                  {/* Discount toggle */}
                                  <div className="flex justify-center px-2 py-2">
                                    <Toggle
                                      label=""
                                      value={cfg.hasDiscount}
                                      onChange={(v) =>
                                        setVariantField(
                                          cid,
                                          sid,
                                          "hasDiscount",
                                          v,
                                        )
                                      }
                                      showText={false}
                                    />
                                  </div>
                                  {/* Indicative toggle */}
                                  <div className="flex justify-center px-2 py-2">
                                    <Toggle
                                      label=""
                                      value={cfg.isIndicativePrice}
                                      onChange={(v) =>
                                        setVariantField(
                                          cid,
                                          sid,
                                          "isIndicativePrice",
                                          v,
                                        )
                                      }
                                      showText={false}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
          {/* END RIGHT PANEL */}
        </div>
        {/* END TWO-COLUMN */}

        {/* ═══════════════════════ FILTROS ══════════════════════════════════ */}
        <div className="bg-card rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <SectionHeading>Filtros</SectionHeading>
            {canEditProduct && (
              <button
                type="button"
                onClick={() => addFilterAssignment()}
                className="h-10 px-5 rounded-xl bg-navy text-white text-s font-semibold font-figtree hover:bg-primary transition-colors"
              >
                Adicionar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: filter pickers */}
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel>Filtros da categoria principal</FieldLabel>
                <SearchableSelect
                  value={l0FilterId}
                  onChange={(id) => {
                    setL0FilterId(id);
                    setL0FilterValueIds(
                      filterAssignments
                        .find((a) => a.filterId === id)
                        ?.values.map((v) => v.id) ?? [],
                    );
                  }}
                  options={l0FilterOptions}
                  placeholder={
                    selectedL0Ids.length > 0
                      ? "Selecione o filtro"
                      : "Selecione a categoria principal primeiro"
                  }
                  disabled={selectedL0Ids.length === 0}
                />
              </div>
              <div>
                <FieldLabel>Filtros da categoria secundária</FieldLabel>
                <SearchableSelect
                  value={l1FilterId}
                  onChange={(id) => {
                    setL1FilterId(id);
                    setL1FilterValueIds(
                      filterAssignments
                        .find((a) => a.filterId === id)
                        ?.values.map((v) => v.id) ?? [],
                    );
                  }}
                  options={l1FilterOptions}
                  placeholder={
                    selectedL1Ids.length > 0
                      ? "Selecione o filtro"
                      : "Selecione sub categoria primeiro"
                  }
                  disabled={selectedL1Ids.length === 0}
                />
              </div>
              <div>
                <FieldLabel>Filtros da categoria terciária</FieldLabel>
                <SearchableSelect
                  value={l2FilterId}
                  onChange={(id) => {
                    setL2FilterId(id);
                    setL2FilterValueIds(
                      filterAssignments
                        .find((a) => a.filterId === id)
                        ?.values.map((v) => v.id) ?? [],
                    );
                  }}
                  options={l2FilterOptions}
                  placeholder={
                    selectedL2Ids.length > 0
                      ? "Selecione o filtro"
                      : "Selecione sub categoria mais íntima primeiro"
                  }
                  disabled={selectedL2Ids.length === 0}
                />
              </div>
            </div>

            {/* Right: value pickers (multi-select) */}
            <div className="flex flex-col gap-4">
              <div>
                <FieldLabel>
                  Valores do filtro da categoria principal
                </FieldLabel>
                <MultiSelectDropdown
                  label=""
                  options={l0ValueOptions}
                  selected={l0FilterValueIds}
                  onChange={setL0FilterValueIds}
                  placeholder={
                    l0FilterId
                      ? "Selecione os valores"
                      : "Selecione o filtro primeiro"
                  }
                  disabled={!l0FilterId}
                  searchable
                />
              </div>
              <div>
                <FieldLabel>
                  Valores do filtro da categoria secundária
                </FieldLabel>
                <MultiSelectDropdown
                  label=""
                  options={l1ValueOptions}
                  selected={l1FilterValueIds}
                  onChange={setL1FilterValueIds}
                  placeholder={
                    l1FilterId
                      ? "Selecione os valores"
                      : "Selecione o filtro primeiro"
                  }
                  disabled={!l1FilterId}
                  searchable
                />
              </div>
              <div>
                <FieldLabel>
                  Valores do filtro da categoria terciária
                </FieldLabel>
                <MultiSelectDropdown
                  label=""
                  options={l2ValueOptions}
                  selected={l2FilterValueIds}
                  onChange={setL2FilterValueIds}
                  placeholder={
                    l2FilterId
                      ? "Selecione os valores"
                      : "Selecione o filtro primeiro"
                  }
                  disabled={!l2FilterId}
                  searchable
                />
              </div>
            </div>
          </div>

          {/* Assigned filter values — column per level, eligibility-driven */}
          {filterAssignments.length > 0 &&
            (() => {
              const allEligibleIds = new Set([
                ...l0FiltersRaw.map((f) => f.id),
                ...l1FiltersRaw.map((f) => f.id),
                ...l2FiltersRaw.map((f) => f.id),
              ]);
              const orphaned = filterAssignments.filter(
                (a) => !allEligibleIds.has(a.filterId),
              );
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-border-light">
                    {(["L0", "L1", "L2"] as const).map((level) => {
                      const assignments = filterAssignments.filter((a) => {
                        if (level === "L0")
                          return l0FiltersRaw.some((f) => f.id === a.filterId);
                        if (level === "L1")
                          return (
                            l1FiltersRaw.some((f) => f.id === a.filterId) &&
                            !l0FilterIdSet.has(a.filterId)
                          );
                        return (
                          l2FiltersRaw.some((f) => f.id === a.filterId) &&
                          !l0FilterIdSet.has(a.filterId) &&
                          !l1FilterIdSet.has(a.filterId)
                        );
                      });
                      const levelLabel =
                        level === "L0"
                          ? "principal"
                          : level === "L1"
                            ? "secundária"
                            : "terciária";
                      return (
                        <div key={level} className="flex flex-col gap-3">
                          <span className="text-md font-bold text-primary font-figtree">
                            Valores atribuídos a categoria {levelLabel}
                          </span>
                          {assignments.length === 0 ? (
                            <p className="text-s text-text-muted font-figtree italic">
                              Nenhum filtro atribuído.
                            </p>
                          ) : (
                            assignments.map((a) => (
                              <div
                                key={a.filterId}
                                className="flex flex-col gap-2 pb-3 border-b border-border-light last:border-b-0"
                              >
                                <span className="inline-flex px-3 py-1 rounded-lg bg-accent text-white text-[12px] font-bold font-figtree w-fit">
                                  {a.filterName}
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {a.values.map((v) => (
                                    <span
                                      key={v.id}
                                      className="inline-flex px-3 py-1 rounded-full bg-navy text-white text-[12px] font-figtree"
                                    >
                                      {v.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {orphaned.length > 0 && (
                    <div className="flex flex-col gap-2 p-4 rounded-xl border border-warning bg-warning/10 mt-2">
                      <p className="text-s font-bold text-warning font-figtree">
                        ⚠ Filtros sem associação de categoria
                      </p>
                      <p className="text-[12px] text-text-body font-figtree">
                        Os seguintes filtros estavam associados a este produto
                        mas já não pertencem a nenhuma das categorias
                        seleccionadas. Guarde o produto para os remover, ou
                        reatribua as categorias.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {orphaned.map((a) => (
                          <span
                            key={a.filterId}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-warning text-warning text-[12px] font-bold font-figtree"
                          >
                            {a.filterName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
        </div>

        {/* ════════════════════ ANÁLISE FINANCEIRA ══════════════════════════ */}
        <div className="bg-card rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <SectionHeading>Análise financeira</SectionHeading>
            <button
              type="button"
              onClick={() =>
                setSuppliers((p) => [...p, newSupplierRow(basePrice)])
              }
              className="w-11 h-11 rounded-xl border border-border-light flex items-center justify-center text-text-muted hover:border-accent hover:text-accent transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1640px] text-s font-inter border-collapse">
              <thead>
                <tr className="bg-navy rounded-xl">
                  {[
                    "Fornecedor",
                    "Link",
                    "Endereço e contacto",
                    "Contacto",
                    "Moeda",
                    "Câmbio",
                    "Preço do fornecedor",
                    "Custo com entrega",
                    "Preço convertido",
                    "Taxa de entrega na cidade",
                    "Outros custos",
                    "Preço proposto",
                    "Margem",
                    "",
                  ].map((col, idx) => (
                    <th
                      key={idx}
                      className={`px-4 py-3 text-left text-s font-semibold text-white font-figtree whitespace-nowrap ${idx === 0 ? "rounded-l-xl" : ""} ${idx === 13 ? "rounded-r-xl" : ""}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers
                  .filter((r) => !pendingDeleteSupplierIds.includes(r.id))
                  .map((row, i) => {
                    const currency = (currencyRates ?? []).find(
                      (c) => c.id === row.currencyRateId,
                    );
                    const rate = currency ? Number(currency.rate) : 0;
                    const clientTotal = parseFloat(row.priceWithDelivery) || 0;
                    const preçoConvertido = clientTotal * rate;
                    const deliveryTax = parseFloat(row.deliveryTax) || 0;
                    const otherCosts = parseFloat(row.otherCosts) || 0;
                    const proposed = parseFloat(row.proposedPrice) || 0;
                    const margem =
                      proposed - preçoConvertido - deliveryTax - otherCosts;
                    const canCalc = proposed > 0 && preçoConvertido > 0;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border-light last:border-b-0 hover:bg-surface-hover/40 transition-colors group"
                      >
                        {/* Fornecedor */}
                        <td className="px-4 py-2 min-w-[130px]">
                          <input
                            value={row.supplierName}
                            onChange={(e) =>
                              updateSupplier(i, "supplierName", e.target.value)
                            }
                            placeholder="Nome…"
                            className="w-full bg-transparent text-text-dark text-s font-figtree focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Link */}
                        <td className="px-4 py-2 min-w-[130px]">
                          <input
                            value={row.supplierLink}
                            onChange={(e) =>
                              updateSupplier(i, "supplierLink", e.target.value)
                            }
                            placeholder="https://…"
                            className="w-full bg-transparent text-accent text-s font-figtree focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Endereço e contacto */}
                        <td className="px-4 py-2 min-w-[160px]">
                          <input
                            value={row.address}
                            onChange={(e) =>
                              updateSupplier(i, "address", e.target.value)
                            }
                            placeholder="Endereço…"
                            className="w-full bg-transparent text-text-dark text-s font-figtree focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Contacto */}
                        <td className="px-4 py-2 min-w-[120px]">
                          <input
                            value={row.contact}
                            onChange={(e) =>
                              updateSupplier(i, "contact", e.target.value)
                            }
                            placeholder="+258…"
                            className="w-full bg-transparent text-text-dark text-s font-figtree focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Moeda — dropdown, auto-fills Câmbio */}
                        <td className="px-4 py-2 min-w-[110px]">
                          <div className="relative">
                            <select
                              value={row.currencyRateId}
                              onChange={(e) =>
                                updateSupplier(
                                  i,
                                  "currencyRateId",
                                  e.target.value,
                                )
                              }
                              className="w-full bg-transparent text-text-dark text-s font-figtree focus:outline-none cursor-pointer py-1 appearance-none pr-5"
                            >
                              <option value="">—</option>
                              {(currencyRates ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.code}
                                </option>
                              ))}
                            </select>
                            <svg
                              className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-text-muted"
                              width="12"
                              height="12"
                              viewBox="0 0 12 12"
                              fill="none"
                            >
                              <path
                                d="M2 4l4 4 4-4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        </td>
                        {/* Câmbio — auto from selected currency */}
                        <td className="px-4 py-2 min-w-[80px]">
                          <span className="text-text-muted text-s font-inter">
                            {rate > 0 ? rate.toFixed(2) : "—"}
                          </span>
                        </td>
                        {/* Preço do fornecedor */}
                        <td className="px-4 py-2 min-w-[130px]">
                          <input
                            type="number"
                            min={0}
                            value={row.supplierPrice}
                            onChange={(e) =>
                              updateSupplier(i, "supplierPrice", e.target.value)
                            }
                            placeholder="0"
                            className="w-full bg-transparent text-text-dark text-s font-inter focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Custo com entrega */}
                        <td className="px-4 py-2 min-w-[130px]">
                          <input
                            type="number"
                            min={0}
                            value={row.priceWithDelivery}
                            onChange={(e) =>
                              updateSupplier(
                                i,
                                "priceWithDelivery",
                                e.target.value,
                              )
                            }
                            placeholder="0"
                            className="w-full bg-transparent text-text-dark text-s font-inter focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Preço convertido — Custo com entrega × Câmbio */}
                        <td className="px-4 py-2 min-w-[130px]">
                          <span className="text-text-dark text-s font-inter font-semibold">
                            {rate > 0 && clientTotal > 0
                              ? preçoConvertido.toLocaleString("pt-MZ", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </span>
                        </td>
                        {/* Taxa de entrega na cidade */}
                        <td className="px-4 py-2 min-w-[140px]">
                          <input
                            type="number"
                            min={0}
                            value={row.deliveryTax}
                            onChange={(e) =>
                              updateSupplier(i, "deliveryTax", e.target.value)
                            }
                            placeholder="0"
                            className="w-full bg-transparent text-text-dark text-s font-inter focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Outros custos */}
                        <td className="px-4 py-2 min-w-[110px]">
                          <input
                            type="number"
                            min={0}
                            value={row.otherCosts}
                            onChange={(e) =>
                              updateSupplier(i, "otherCosts", e.target.value)
                            }
                            placeholder="0"
                            className="w-full bg-transparent text-text-dark text-s font-inter focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Preço proposto — editable per row */}
                        <td className="px-4 py-2 min-w-[130px]">
                          <input
                            type="number"
                            min={0}
                            value={row.proposedPrice}
                            onChange={(e) =>
                              updateSupplier(i, "proposedPrice", e.target.value)
                            }
                            placeholder="0"
                            className="w-full bg-transparent text-text-dark text-s font-inter focus:outline-none placeholder:text-border py-1"
                          />
                        </td>
                        {/* Margem — Preço proposto − Preço convertido − Taxa cidade − Outros custos */}
                        <td className="px-4 py-2 min-w-[100px]">
                          <span
                            className={`text-s font-inter font-semibold ${
                              canCalc
                                ? margem >= 0
                                  ? "text-success"
                                  : "text-danger"
                                : "text-text-muted"
                            }`}
                          >
                            {canCalc
                              ? margem.toLocaleString("pt-MZ", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </span>
                        </td>
                        {/* Delete */}
                        <td className="px-2 py-2 w-22">
                          {confirmDeleteSupplier === i ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSupplier(null)}
                                className="h-6 px-2 rounded-md text-xxs font-semibold font-figtree text-text-muted border border-border-light hover:bg-surface-hover transition-colors"
                              >
                                Não
                              </button>
                              <button
                                type="button"
                                onClick={() => removeSupplier(i)}
                                className="h-6 px-2 rounded-md text-xxs font-semibold font-figtree text-white bg-danger hover:bg-danger/80 transition-colors"
                              >
                                Sim
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSupplier(i)}
                              className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-danger hover:bg-surface-hover transition-all"
                              title="Remover linha"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 14 14"
                                fill="none"
                              >
                                <path
                                  d="M2 2l10 10M12 2L2 12"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {suppliers.length === 0 && (
              <p className="text-center text-s text-text-muted font-figtree py-6">
                Nenhuma análise financeira adicionada. Clique em + para
                adicionar.
              </p>
            )}
          </div>
        </div>

        {/* ═══════════════════════ CONCORRENTES ═════════════════════════════ */}
        <div className="bg-card rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <SectionHeading>Concorrentes</SectionHeading>
            <button
              type="button"
              onClick={() => setCompetitors((p) => [...p, newCompetitor()])}
              className="w-11 h-11 rounded-xl border border-border-light flex items-center justify-center text-text-muted hover:border-accent hover:text-accent transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>

          {competitors.length === 0 ? (
            <p className="text-s text-text-muted font-figtree text-center py-4">
              Nenhum concorrente adicionado. Clique em + para adicionar.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {competitors
                .filter((c) => !pendingDeleteCompetitorIds.includes(c.id))
                .map((c, i) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 p-4 rounded-xl border border-border-light relative"
                  >
                    {confirmDeleteCompetitor === i ? (
                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCompetitor(null)}
                          className="h-6 px-2 rounded-md text-xxs font-semibold font-figtree text-text-muted border border-border-light hover:bg-surface-hover transition-colors"
                        >
                          Não
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCompetitor(i)}
                          className="h-6 px-2 rounded-md text-xxs font-semibold font-figtree text-white bg-danger hover:bg-danger/80 transition-colors"
                        >
                          Sim
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCompetitor(i)}
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:bg-danger/10 hover:text-danger transition-colors"
                        title="Remover concorrente"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <div>
                      <FieldLabel>Nome</FieldLabel>
                      <Input
                        value={c.name}
                        onChange={(v) => updateCompetitor(i, "name", v)}
                        placeholder="Nome do concorrente"
                      />
                    </div>
                    <div>
                      <FieldLabel>Link</FieldLabel>
                      <Input
                        value={c.link}
                        onChange={(v) => updateCompetitor(i, "link", v)}
                        placeholder="Link do produto"
                      />
                    </div>
                    <div>
                      <FieldLabel>Preço*</FieldLabel>
                      <Input
                        value={c.price}
                        onChange={(v) => updateCompetitor(i, "price", v)}
                        type="number"
                        placeholder="0"
                        suffix="Mzn"
                      />
                    </div>
                    <div>
                      <FieldLabel>Comentário breve</FieldLabel>
                      <Textarea
                        value={c.comment}
                        onChange={(v) => updateCompetitor(i, "comment", v)}
                        placeholder="As suas observações do concorrente vão aqui…"
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Bottom action buttons */}
          {canEditProduct && (
            <div className="flex justify-end gap-3 pt-2 border-t border-border-light">
              <button
                type="button"
                disabled={isPending || isUploading}
                onClick={() => handleSave(false)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl border border-border-light text-text-body text-s font-semibold font-figtree hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {isUploading ? "A carregar imagens…" : "Guardar rascunho"}
              </button>
              <button
                type="button"
                disabled={isPending || isUploading}
                onClick={() => handleSave(true)}
                className="h-10 px-5 rounded-xl bg-navy text-white text-s font-semibold font-figtree hover:bg-primary transition-colors disabled:opacity-50"
              >
                {isUploading
                  ? "A carregar…"
                  : reviewMode
                    ? "Enviar para revisão"
                    : "Publicar"}
              </button>
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
}
