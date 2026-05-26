import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const GenderScope = z.enum(["women", "men", "kids", "unisex"]);
export const Platform = z.enum(["web", "ios", "android"]);
export const SizeSystem = z.enum(["EU", "US", "UK", "IT", "universal"]);
export const InputType = z.enum([
  "multi_select",
  "single_select",
  "range",
  "boolean",
]);
export const MediaType = z.enum(["image", "video"]);
export const StockStatus = z.enum(["in_stock", "by_importation"]);
export const ProductStatus = z.enum(["draft", "published", "archived"]);
export const OrderStatus = z.enum([
  "pending",
  "paid",
  "in_process",
  "in_transit",
  "delivered",
  "returned",
  "cancelled",
]);
export const SenderType = z.enum(["user", "admin"]);
export const MessageMediaType = z.enum(["image", "video"]);

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    total: z.number().optional(),
  });

// ─── Category ─────────────────────────────────────────────────────────────────

export const CreateCategorySchema = z.object({
  parentId: z.string().uuid().optional(),
  level: z.number().int().min(0).max(2),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
  genderScope: GenderScope.optional(),
  position: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const ReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

// ─── Brand ────────────────────────────────────────────────────────────────────

export const CreateBrandSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  logoUrl: z.string().url().optional(),
  landingImage1Url: z.string().url().optional(),
  landingImage2Url: z.string().url().optional(),
  status: z.enum(["draft", "published"]).default("published"),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const UpdateBrandSchema = CreateBrandSchema.partial();

// ─── Collection ───────────────────────────────────────────────────────────────

export const CreateCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  coverImageUrl: z.string().url().optional(),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const UpdateCollectionSchema = CreateCollectionSchema.partial();

// ─── Color ────────────────────────────────────────────────────────────────────

export const CreateColorSchema = z.object({
  name: z.string().min(1).max(50),
  hexCode: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (#RRGGBB)"),
});

export const UpdateColorSchema = CreateColorSchema.partial();

// ─── Size ─────────────────────────────────────────────────────────────────────

export const CreateSizeSchema = z.object({
  name: z.string().min(1).max(20),
  label: z.string().min(1).max(20),
  sizeSystem: SizeSystem.default("universal"),
  position: z.number().int().default(0),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const UpdateSizeSchema = CreateSizeSchema.partial();

// ─── Size Guide ───────────────────────────────────────────────────────────────

export const SizeGuideImageSchema = z.object({
  url: z.string().url(),
  position: z.number().int().default(0),
});

export const CreateSizeGuideSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  images: z.array(SizeGuideImageSchema).default([]),
});

export const UpdateSizeGuideSchema = CreateSizeGuideSchema.partial();

// ─── Attribute Definition ─────────────────────────────────────────────────────

export const CreateAttributeDefinitionSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1),
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  inputType: InputType.default("multi_select"),
  position: z.number().int().default(0),
  isActive: z.boolean().default(true),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(100),
        value: z.string().min(1).max(100),
        position: z.number().int().default(0),
      }),
    )
    .min(1),
});

export const UpdateAttributeDefinitionSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  inputType: InputType.optional(),
  position: z.number().int().optional(),
  isActive: z.boolean().optional(),
  options: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        label: z.string().min(1).max(100),
        value: z.string().min(1).max(100),
        position: z.number().int().default(0),
      }),
    )
    .optional(),
});

// ─── Product ──────────────────────────────────────────────────────────────────

export const PolicyItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
});

export const ProductMediaInputSchema = z.object({
  colorId: z.string().uuid().optional(),
  url: z.string().url(),
  mediaType: MediaType,
  position: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export const ProductVariantInputSchema = z.object({
  colorId: z.string().uuid(),
  sizeId: z.string().uuid(),
  stockQuantity: z.number().int().min(0).default(0),
  price: z.number().positive().optional(),
  hasDiscount: z.boolean().default(false),
  discountPrice: z.number().positive().optional(),
  isIndicativePrice: z.boolean().default(false),
});

export const ProductAttributeInputSchema = z.object({
  attributeDefinitionId: z.string().uuid(),
  attributeOptionIds: z.array(z.string().uuid()).min(1),
});

export const CreateProductBaseSchema = z.object({
  brandId: z.string().uuid(),
  collectionIds: z.array(z.string().uuid()).optional(),
  sizeGuideId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(5000).optional(),
  basePrice: z.number().nonnegative(),
  isIndicativePrice: z.boolean().default(false),
  hasDiscount: z.boolean().default(false),
  discountPrice: z.number().positive().optional(),
  stockStatus: StockStatus.default("in_stock"),
  status: ProductStatus.default("draft"),
  isVisible: z.boolean().default(true),
  keyCharacteristics: z.string().optional(),
  productInfo: z.string().optional(),
  sendPolicy: z.string().optional(),
  returnPolicy: z.string().optional(),
  deliveryEstimate: z.string().optional(),
  supplierLink: z.string().url().optional(),
  mainColorId: z.string().uuid().optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  sizeIds: z.array(z.string().uuid()).optional(),
  variants: z.array(ProductVariantInputSchema).optional(),
  media: z.array(ProductMediaInputSchema).optional(),
  attributes: z.array(ProductAttributeInputSchema).optional(),
});

export const CreateProductSchema = CreateProductBaseSchema.refine(
  (d) =>
    !d.hasDiscount ||
    (d.discountPrice !== undefined && d.discountPrice < d.basePrice),
  {
    message:
      "discountPrice is required and must be less than basePrice when hasDiscount is true",
    path: ["discountPrice"],
  },
);

export const UpdateProductSchema = CreateProductBaseSchema.partial();

// ─── Product Supplier (Financial Analysis) ────────────────────────────────────

export const CreateProductSupplierSchema = z.object({
  supplierName: z.string().min(1).max(200),
  supplierLink: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  contact: z.string().max(200).optional(),
  currencyRateId: z.string().uuid().optional(),
  supplierPrice: z.number().nonnegative(),
  priceWithDelivery: z.number().nonnegative(),
  deliveryTax: z.number().nonnegative(),
  otherCosts: z.number().nonnegative(),
  proposedPrice: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export const CreateProductCompetitorSchema = z.object({
  link: z.string().url(),
  price: z.number().nonnegative(),
  comments: z.string().max(1000).optional(),
});

// ─── Order ────────────────────────────────────────────────────────────────────

export const CreateOrderSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid(),
  proofNotes: z.string().max(1000).optional(),
  shippingCost: z.number().nonnegative().default(0),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        productVariantId: z.string().uuid(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
      }),
    )
    .min(1),
});

// pending is only an entry state (set on creation); status updates cannot revert to pending
export const UpdateOrderStatusSchema = z
  .object({
    status: z.enum([
      "paid",
      "in_process",
      "in_transit",
      "delivered",
      "returned",
      "cancelled",
    ]),
    shippingCost: z.number().nonnegative().optional(),
    proofNotes: z.string().max(1000).optional(),
    returnReason: z.string().max(1000).optional(),
    returnProof: z.array(z.string().url()).optional(),
    cancellationReason: z.string().max(1000).optional(),
  })
  .refine((d) => d.status !== "returned" || !!d.returnReason, {
    message: "returnReason is required when status is returned",
    path: ["returnReason"],
  })
  .refine((d) => d.status !== "cancelled" || !!d.cancellationReason, {
    message: "cancellationReason is required when status is cancelled",
    path: ["cancellationReason"],
  });

export const UpdateOrderItemSchema = z.object({
  quantity: z.number().int().min(0).optional(),
  unitPrice: z.number().positive().optional(),
});

// ─── Cart ─────────────────────────────────────────────────────────────────────

export const AddToCartSchema = z.object({
  productId: z.string().uuid(),
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
});

// ─── Story ────────────────────────────────────────────────────────────────────

export const StorySlideInputSchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: MediaType,
  position: z.number().int().default(0),
  productIds: z.array(z.string().uuid()).default([]),
});

export const CreateStorySchema = z.object({
  name: z.string().min(1).max(200),
  thumbnailUrl: z.string().url().optional(),
  position: z.number().int().default(0),
  slides: z.array(StorySlideInputSchema).min(1),
});

export const UpdateStorySchema = CreateStorySchema.partial();

// ─── Most Searched ────────────────────────────────────────────────────────────

export const CreateMostSearchedSchema = z.object({
  categoryId: z.string().uuid(),
  position: z.number().int().default(0),
});

// ─── Currency Rate ────────────────────────────────────────────────────────────

export const CreateCurrencyRateSchema = z.object({
  code: z.string().min(1).max(10),
  name: z.string().min(1).max(50),
  symbol: z.string().min(1).max(10),
  rate: z.number().positive(),
});

export const UpdateCurrencyRateSchema = CreateCurrencyRateSchema.partial();

// ─── Admin User ───────────────────────────────────────────────────────────────

export const CreateAdminUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
  roleKey: z
    .enum([
      "super_admin",
      "admin_no_role_manager",
      "customer_care",
      "finance",
      "product_analyst",
      "content_manager",
    ])
    .optional()
    .nullable(),
  permissions: z.number().int().nonnegative().optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const UpdateAdminUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  roleKey: z
    .enum([
      "super_admin",
      "admin_no_role_manager",
      "customer_care",
      "finance",
      "product_analyst",
      "content_manager",
    ])
    .optional()
    .nullable(),
  permissions: z.number().int().nonnegative().optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const FcmTokenSchema = z.object({
  token: z.string().min(1).max(500),
});

export const ResetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number"),
});

// ─── Auth (Client) ────────────────────────────────────────────────────────────

export const GoogleAuthSchema = z.object({
  idToken: z.string().min(1),
});

export const UpdateContactSchema = z
  .object({
    phone: z.string().min(7).max(20).optional(),
    whatsappNumber: z.string().min(7).max(20).optional(),
  })
  .refine((d) => d.phone !== undefined || d.whatsappNumber !== undefined, {
    message: "At least one contact field is required",
  });

// ─── Message ──────────────────────────────────────────────────────────────────

export const SendMessageSchema = z
  .object({
    content: z.string().max(5000).optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: MessageMediaType.optional(),
  })
  .refine((d) => d.content || d.mediaUrl, {
    message: "Either content or mediaUrl is required",
  });

// ─── Media ────────────────────────────────────────────────────────────────────

export const PresignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().regex(/^(image|video)\/.+/),
  context: z.enum([
    "chat",
    "product",
    "story",
    "brand",
    "category",
    "size_guide",
    "avatar",
    "collection",
  ]),
});

// ─── Analytics ────────────────────────────────────────────────────────────────

export const VisitorSessionSchema = z.object({
  platform: Platform,
});

// ─── Permission Bitmask Constants ─────────────────────────────────────────────

export const Permissions = {
  DASHBOARD_VIEW: 1 << 0, // 1
  ORDERS_VIEW: 1 << 1, // 2
  ORDERS_EDIT: 1 << 2, // 4
  CLIENTS_VIEW: 1 << 3, // 8
  PRODUCTS_VIEW: 1 << 4, // 16
  PRODUCTS_CREATE: 1 << 5, // 32
  PRODUCTS_EDIT: 1 << 6, // 64
  CATEGORIES_EDIT: 1 << 7, // 128
  BRANDS_EDIT: 1 << 8, // 256
  FILTERS_EDIT: 1 << 9, // 512
  SIZES_EDIT: 1 << 10, // 1024
  COLORS_EDIT: 1 << 11, // 2048
  COLLECTIONS_EDIT: 1 << 12, // 4096
  STORIES_EDIT: 1 << 13, // 8192
  MOST_SEARCHED_EDIT: 1 << 14, // 16384
  CURRENCY_EDIT: 1 << 15, // 32768
  CHATS_VIEW: 1 << 16, // 65536
  ANALYTICS_VIEW: 1 << 17, // 131072
  AUTHORITY_MANAGE: 1 << 18, // 262144
} as const;

export const ALL_PERMISSIONS = Object.values(Permissions).reduce(
  (a, b) => a | b,
  0,
);

export const MANAGE_STRUCTURE =
  Permissions.ORDERS_VIEW |
  Permissions.ORDERS_EDIT |
  Permissions.SIZES_EDIT |
  Permissions.COLORS_EDIT |
  Permissions.FILTERS_EDIT |
  Permissions.MOST_SEARCHED_EDIT |
  Permissions.STORIES_EDIT |
  Permissions.CURRENCY_EDIT;

export const MANAGE_PRODUCTS =
  Permissions.PRODUCTS_VIEW |
  Permissions.PRODUCTS_CREATE |
  Permissions.PRODUCTS_EDIT;

export const hasPermission = (
  userPermissions: bigint | number,
  permission: number,
): boolean => {
  return (Number(userPermissions) & permission) === permission;
};

// ─── Role System ─────────────────────────────────────────────────────────────

export const RoleKeySchema = z.enum([
  "super_admin",
  "admin_no_role_manager",
  "customer_care",
  "finance",
  "product_analyst",
  "content_manager",
]);

export type RoleKey = z.infer<typeof RoleKeySchema>;

export type RoleRules = {
  canManageAuthority: boolean;
  canCreateOrder: boolean;
  canEditOrderItems: boolean;
  canMarkOrderPaid: boolean;
  canUpdateOrderStatusesExceptPaid: boolean;
  canSetAnyOrderStatusExceptPaid: boolean;
  canOnlyCancelOrders: boolean;
  canEditVisibleProducts: boolean;
  canDeleteProduct: boolean;
  canChangeProductVisibility: boolean;
  canPublishProductStatus: boolean;
  forceProductVisibilityFalseOnSave: boolean;
};

type RoleDefinition = {
  label: string;
  permissions: number;
  rules: RoleRules;
};

const ROLE_DEFINITIONS: Record<RoleKey, RoleDefinition> = {
  super_admin: {
    label: "Super Admin",
    permissions: ALL_PERMISSIONS,
    rules: {
      canManageAuthority: true,
      canCreateOrder: true,
      canEditOrderItems: true,
      canMarkOrderPaid: true,
      canUpdateOrderStatusesExceptPaid: true,
      canSetAnyOrderStatusExceptPaid: true,
      canOnlyCancelOrders: false,
      canEditVisibleProducts: true,
      canDeleteProduct: true,
      canChangeProductVisibility: true,
      canPublishProductStatus: true,
      forceProductVisibilityFalseOnSave: false,
    },
  },
  admin_no_role_manager: {
    label: "Admin Sem Gestao de Roles",
    permissions: ALL_PERMISSIONS & ~Permissions.AUTHORITY_MANAGE,
    rules: {
      canManageAuthority: false,
      canCreateOrder: true,
      canEditOrderItems: true,
      canMarkOrderPaid: true,
      canUpdateOrderStatusesExceptPaid: true,
      canSetAnyOrderStatusExceptPaid: true,
      canOnlyCancelOrders: false,
      canEditVisibleProducts: true,
      canDeleteProduct: true,
      canChangeProductVisibility: true,
      canPublishProductStatus: true,
      forceProductVisibilityFalseOnSave: false,
    },
  },
  customer_care: {
    label: "Customer Care",
    permissions:
      Permissions.ORDERS_VIEW |
      Permissions.ORDERS_EDIT |
      Permissions.CHATS_VIEW,
    rules: {
      canManageAuthority: false,
      canCreateOrder: true,
      canEditOrderItems: true,
      canMarkOrderPaid: false,
      canUpdateOrderStatusesExceptPaid: true,
      canSetAnyOrderStatusExceptPaid: false,
      canOnlyCancelOrders: true,
      canEditVisibleProducts: false,
      canDeleteProduct: false,
      canChangeProductVisibility: false,
      canPublishProductStatus: false,
      forceProductVisibilityFalseOnSave: false,
    },
  },
  finance: {
    label: "Finance",
    permissions:
      Permissions.DASHBOARD_VIEW |
      Permissions.ORDERS_VIEW |
      Permissions.ORDERS_EDIT |
      Permissions.CLIENTS_VIEW |
      Permissions.CURRENCY_EDIT,
    rules: {
      canManageAuthority: false,
      canCreateOrder: false,
      canEditOrderItems: false,
      canMarkOrderPaid: true,
      canUpdateOrderStatusesExceptPaid: false,
      canSetAnyOrderStatusExceptPaid: false,
      canOnlyCancelOrders: false,
      canEditVisibleProducts: false,
      canDeleteProduct: false,
      canChangeProductVisibility: false,
      canPublishProductStatus: false,
      forceProductVisibilityFalseOnSave: false,
    },
  },
  product_analyst: {
    label: "Product Analyst",
    permissions:
      Permissions.PRODUCTS_VIEW |
      Permissions.PRODUCTS_CREATE |
      Permissions.PRODUCTS_EDIT |
      Permissions.CATEGORIES_EDIT |
      Permissions.BRANDS_EDIT |
      Permissions.FILTERS_EDIT |
      Permissions.SIZES_EDIT |
      Permissions.COLORS_EDIT |
      Permissions.COLLECTIONS_EDIT |
      Permissions.MOST_SEARCHED_EDIT,
    rules: {
      canManageAuthority: false,
      canCreateOrder: false,
      canEditOrderItems: false,
      canMarkOrderPaid: false,
      canUpdateOrderStatusesExceptPaid: false,
      canSetAnyOrderStatusExceptPaid: false,
      canOnlyCancelOrders: false,
      canEditVisibleProducts: false,
      canDeleteProduct: false,
      canChangeProductVisibility: false,
      canPublishProductStatus: false,
      forceProductVisibilityFalseOnSave: true,
    },
  },
  content_manager: {
    label: "Content Manager",
    permissions: Permissions.STORIES_EDIT | Permissions.PRODUCTS_VIEW,
    rules: {
      canManageAuthority: false,
      canCreateOrder: false,
      canEditOrderItems: false,
      canMarkOrderPaid: false,
      canUpdateOrderStatusesExceptPaid: false,
      canSetAnyOrderStatusExceptPaid: false,
      canOnlyCancelOrders: false,
      canEditVisibleProducts: false,
      canDeleteProduct: false,
      canChangeProductVisibility: false,
      canPublishProductStatus: false,
      forceProductVisibilityFalseOnSave: false,
    },
  },
};

export const SYSTEM_ROLES: { key: RoleKey; permissions: number }[] = (
  Object.entries(ROLE_DEFINITIONS) as [RoleKey, RoleDefinition][]
).map(([key, definition]) => ({ key, permissions: definition.permissions }));

export function getRoleRules(roleKey: RoleKey): RoleRules {
  return ROLE_DEFINITIONS[roleKey].rules;
}

export function getPermissionsForRole(roleKey: RoleKey): number {
  return ROLE_DEFINITIONS[roleKey].permissions;
}

export function getRoleKeyForPermissions(
  permissions: bigint | number,
): RoleKey | null {
  const p = Number(permissions);
  const match = (
    Object.entries(ROLE_DEFINITIONS) as [RoleKey, RoleDefinition][]
  ).find(([, definition]) => definition.permissions === p);
  return match ? match[0] : null;
}

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateBrandInput = z.infer<typeof CreateBrandSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandSchema>;
export type CreateCollectionInput = z.infer<typeof CreateCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof UpdateCollectionSchema>;
export type CreateColorInput = z.infer<typeof CreateColorSchema>;
export type UpdateColorInput = z.infer<typeof UpdateColorSchema>;
export type CreateSizeInput = z.infer<typeof CreateSizeSchema>;
export type UpdateSizeInput = z.infer<typeof UpdateSizeSchema>;
export type CreateSizeGuideInput = z.infer<typeof CreateSizeGuideSchema>;
export type UpdateSizeGuideInput = z.infer<typeof UpdateSizeGuideSchema>;
export type CreateAttributeDefinitionInput = z.infer<
  typeof CreateAttributeDefinitionSchema
>;
export type UpdateAttributeDefinitionInput = z.infer<
  typeof UpdateAttributeDefinitionSchema
>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type CreateStoryInput = z.infer<typeof CreateStorySchema>;
export type UpdateStoryInput = z.infer<typeof UpdateStorySchema>;
export type CreateMostSearchedInput = z.infer<typeof CreateMostSearchedSchema>;
export type CreateCurrencyRateInput = z.infer<typeof CreateCurrencyRateSchema>;
export type UpdateCurrencyRateInput = z.infer<typeof UpdateCurrencyRateSchema>;
export type CreateAdminUserInput = z.infer<typeof CreateAdminUserSchema>;
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type PresignRequestInput = z.infer<typeof PresignRequestSchema>;
export type PaginationQueryInput = z.infer<typeof PaginationQuery>;
export type ReorderInput = z.infer<typeof ReorderSchema>;
