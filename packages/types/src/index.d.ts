import { z } from "zod";
export declare const GenderScope: z.ZodEnum<["women", "men", "kids", "unisex"]>;
export declare const Platform: z.ZodEnum<["web", "ios", "android"]>;
export declare const SizeSystem: z.ZodEnum<["EU", "US", "UK", "IT", "universal"]>;
export declare const InputType: z.ZodEnum<["multi_select", "single_select", "range", "boolean"]>;
export declare const MediaType: z.ZodEnum<["image", "video"]>;
export declare const StockStatus: z.ZodEnum<["in_stock", "by_importation"]>;
export declare const ProductStatus: z.ZodEnum<["draft", "published", "archived"]>;
export declare const OrderStatus: z.ZodEnum<["pending", "paid", "in_process", "in_transit", "delivered", "returned", "cancelled"]>;
export declare const SenderType: z.ZodEnum<["user", "admin"]>;
export declare const MessageMediaType: z.ZodEnum<["image", "video"]>;
export declare const PaginationQuery: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export declare const PaginatedResponse: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodObject<{
    items: z.ZodArray<T, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
    total: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    nextCursor: string | null;
    items: T["_output"][];
    total?: number | undefined;
}, {
    nextCursor: string | null;
    items: T["_input"][];
    total?: number | undefined;
}>;
export declare const CreateCategorySchema: z.ZodObject<{
    parentId: z.ZodOptional<z.ZodString>;
    level: z.ZodNumber;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    iconUrl: z.ZodOptional<z.ZodString>;
    genderScope: z.ZodOptional<z.ZodEnum<["women", "men", "kids", "unisex"]>>;
    position: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    level: number;
    name: string;
    slug: string;
    position: number;
    isActive: boolean;
    parentId?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    iconUrl?: string | undefined;
    genderScope?: "women" | "men" | "kids" | "unisex" | undefined;
}, {
    level: number;
    name: string;
    slug: string;
    parentId?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    iconUrl?: string | undefined;
    genderScope?: "women" | "men" | "kids" | "unisex" | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const UpdateCategorySchema: z.ZodObject<{
    parentId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    level: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    iconUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    genderScope: z.ZodOptional<z.ZodOptional<z.ZodEnum<["women", "men", "kids", "unisex"]>>>;
    position: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    parentId?: string | undefined;
    level?: number | undefined;
    name?: string | undefined;
    slug?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    iconUrl?: string | undefined;
    genderScope?: "women" | "men" | "kids" | "unisex" | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
}, {
    parentId?: string | undefined;
    level?: number | undefined;
    name?: string | undefined;
    slug?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    iconUrl?: string | undefined;
    genderScope?: "women" | "men" | "kids" | "unisex" | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const ReorderSchema: z.ZodObject<{
    orderedIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    orderedIds: string[];
}, {
    orderedIds: string[];
}>;
export declare const CreateBrandSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    logoUrl: z.ZodOptional<z.ZodString>;
    landingImage1Url: z.ZodOptional<z.ZodString>;
    landingImage2Url: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<["draft", "published"]>>;
    categoryIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    status: "draft" | "published";
    logoUrl?: string | undefined;
    landingImage1Url?: string | undefined;
    landingImage2Url?: string | undefined;
    categoryIds?: string[] | undefined;
}, {
    name: string;
    slug: string;
    status?: "draft" | "published" | undefined;
    logoUrl?: string | undefined;
    landingImage1Url?: string | undefined;
    landingImage2Url?: string | undefined;
    categoryIds?: string[] | undefined;
}>;
export declare const UpdateBrandSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    logoUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    landingImage1Url: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    landingImage2Url: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["draft", "published"]>>>;
    categoryIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    slug?: string | undefined;
    status?: "draft" | "published" | undefined;
    logoUrl?: string | undefined;
    landingImage1Url?: string | undefined;
    landingImage2Url?: string | undefined;
    categoryIds?: string[] | undefined;
}, {
    name?: string | undefined;
    slug?: string | undefined;
    status?: "draft" | "published" | undefined;
    logoUrl?: string | undefined;
    landingImage1Url?: string | undefined;
    landingImage2Url?: string | undefined;
    categoryIds?: string[] | undefined;
}>;
export declare const CreateCollectionSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    coverImageUrl: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    categoryId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    position: number;
    isActive: boolean;
    coverImageUrl?: string | undefined;
    categoryId?: string | null | undefined;
}, {
    name: string;
    slug: string;
    position?: number | undefined;
    isActive?: boolean | undefined;
    coverImageUrl?: string | undefined;
    categoryId?: string | null | undefined;
}>;
export declare const UpdateCollectionSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    coverImageUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    position: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    categoryId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    slug?: string | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
    coverImageUrl?: string | undefined;
    categoryId?: string | null | undefined;
}, {
    name?: string | undefined;
    slug?: string | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
    coverImageUrl?: string | undefined;
    categoryId?: string | null | undefined;
}>;
export declare const CreateColorSchema: z.ZodObject<{
    name: z.ZodString;
    hexCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    hexCode: string;
}, {
    name: string;
    hexCode: string;
}>;
export declare const UpdateColorSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    hexCode: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    hexCode?: string | undefined;
}, {
    name?: string | undefined;
    hexCode?: string | undefined;
}>;
export declare const CreateSizeSchema: z.ZodObject<{
    name: z.ZodString;
    label: z.ZodString;
    sizeSystem: z.ZodDefault<z.ZodEnum<["EU", "US", "UK", "IT", "universal"]>>;
    position: z.ZodDefault<z.ZodNumber>;
    categoryIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    position: number;
    label: string;
    sizeSystem: "EU" | "US" | "UK" | "IT" | "universal";
    categoryIds?: string[] | undefined;
}, {
    name: string;
    label: string;
    position?: number | undefined;
    categoryIds?: string[] | undefined;
    sizeSystem?: "EU" | "US" | "UK" | "IT" | "universal" | undefined;
}>;
export declare const UpdateSizeSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    label: z.ZodOptional<z.ZodString>;
    sizeSystem: z.ZodOptional<z.ZodDefault<z.ZodEnum<["EU", "US", "UK", "IT", "universal"]>>>;
    position: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    categoryIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    position?: number | undefined;
    categoryIds?: string[] | undefined;
    label?: string | undefined;
    sizeSystem?: "EU" | "US" | "UK" | "IT" | "universal" | undefined;
}, {
    name?: string | undefined;
    position?: number | undefined;
    categoryIds?: string[] | undefined;
    label?: string | undefined;
    sizeSystem?: "EU" | "US" | "UK" | "IT" | "universal" | undefined;
}>;
export declare const SizeGuideImageSchema: z.ZodObject<{
    url: z.ZodString;
    position: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    position: number;
    url: string;
}, {
    url: string;
    position?: number | undefined;
}>;
export declare const CreateSizeGuideSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    images: z.ZodDefault<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        position: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        url: string;
    }, {
        url: string;
        position?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    images: {
        position: number;
        url: string;
    }[];
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    images?: {
        url: string;
        position?: number | undefined;
    }[] | undefined;
}>;
export declare const UpdateSizeGuideSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    images: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        position: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        url: string;
    }, {
        url: string;
        position?: number | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    images?: {
        position: number;
        url: string;
    }[] | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    images?: {
        url: string;
        position?: number | undefined;
    }[] | undefined;
}>;
export declare const CreateAttributeDefinitionSchema: z.ZodObject<{
    categoryIds: z.ZodArray<z.ZodString, "many">;
    name: z.ZodString;
    slug: z.ZodOptional<z.ZodString>;
    inputType: z.ZodDefault<z.ZodEnum<["multi_select", "single_select", "range", "boolean"]>>;
    position: z.ZodDefault<z.ZodNumber>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    options: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodString;
        position: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        value: string;
        label: string;
    }, {
        value: string;
        label: string;
        position?: number | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    position: number;
    isActive: boolean;
    options: {
        position: number;
        value: string;
        label: string;
    }[];
    categoryIds: string[];
    inputType: "boolean" | "range" | "multi_select" | "single_select";
    slug?: string | undefined;
}, {
    name: string;
    options: {
        value: string;
        label: string;
        position?: number | undefined;
    }[];
    categoryIds: string[];
    slug?: string | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
    inputType?: "boolean" | "range" | "multi_select" | "single_select" | undefined;
}>;
export declare const UpdateAttributeDefinitionSchema: z.ZodObject<{
    categoryIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    inputType: z.ZodOptional<z.ZodEnum<["multi_select", "single_select", "range", "boolean"]>>;
    position: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        label: z.ZodString;
        value: z.ZodString;
        position: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        value: string;
        label: string;
        id?: string | undefined;
    }, {
        value: string;
        label: string;
        id?: string | undefined;
        position?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    slug?: string | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
    options?: {
        position: number;
        value: string;
        label: string;
        id?: string | undefined;
    }[] | undefined;
    categoryIds?: string[] | undefined;
    inputType?: "boolean" | "range" | "multi_select" | "single_select" | undefined;
}, {
    name?: string | undefined;
    slug?: string | undefined;
    position?: number | undefined;
    isActive?: boolean | undefined;
    options?: {
        value: string;
        label: string;
        id?: string | undefined;
        position?: number | undefined;
    }[] | undefined;
    categoryIds?: string[] | undefined;
    inputType?: "boolean" | "range" | "multi_select" | "single_select" | undefined;
}>;
export declare const PolicyItemSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    description: string;
    title: string;
}, {
    description: string;
    title: string;
}>;
export declare const ProductMediaInputSchema: z.ZodObject<{
    colorId: z.ZodOptional<z.ZodString>;
    url: z.ZodString;
    mediaType: z.ZodEnum<["image", "video"]>;
    position: z.ZodDefault<z.ZodNumber>;
    isPrimary: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    position: number;
    mediaType: "image" | "video";
    url: string;
    isPrimary: boolean;
    colorId?: string | undefined;
}, {
    mediaType: "image" | "video";
    url: string;
    position?: number | undefined;
    colorId?: string | undefined;
    isPrimary?: boolean | undefined;
}>;
export declare const ProductVariantInputSchema: z.ZodObject<{
    colorId: z.ZodString;
    sizeId: z.ZodString;
    stockQuantity: z.ZodDefault<z.ZodNumber>;
    price: z.ZodOptional<z.ZodNumber>;
    hasDiscount: z.ZodDefault<z.ZodBoolean>;
    discountPrice: z.ZodOptional<z.ZodNumber>;
    isIndicativePrice: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    colorId: string;
    sizeId: string;
    stockQuantity: number;
    hasDiscount: boolean;
    isIndicativePrice: boolean;
    price?: number | undefined;
    discountPrice?: number | undefined;
}, {
    colorId: string;
    sizeId: string;
    stockQuantity?: number | undefined;
    price?: number | undefined;
    hasDiscount?: boolean | undefined;
    discountPrice?: number | undefined;
    isIndicativePrice?: boolean | undefined;
}>;
export declare const ProductAttributeInputSchema: z.ZodObject<{
    attributeDefinitionId: z.ZodString;
    attributeOptionIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    attributeDefinitionId: string;
    attributeOptionIds: string[];
}, {
    attributeDefinitionId: string;
    attributeOptionIds: string[];
}>;
export declare const CreateProductBaseSchema: z.ZodObject<{
    brandId: z.ZodString;
    collectionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sizeGuideId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    basePrice: z.ZodNumber;
    isIndicativePrice: z.ZodDefault<z.ZodBoolean>;
    hasDiscount: z.ZodDefault<z.ZodBoolean>;
    discountPrice: z.ZodOptional<z.ZodNumber>;
    stockStatus: z.ZodDefault<z.ZodEnum<["in_stock", "by_importation"]>>;
    status: z.ZodDefault<z.ZodEnum<["draft", "published", "archived"]>>;
    isVisible: z.ZodDefault<z.ZodBoolean>;
    keyCharacteristics: z.ZodOptional<z.ZodString>;
    productInfo: z.ZodOptional<z.ZodString>;
    sendPolicy: z.ZodOptional<z.ZodString>;
    returnPolicy: z.ZodOptional<z.ZodString>;
    deliveryEstimate: z.ZodOptional<z.ZodString>;
    supplierLink: z.ZodOptional<z.ZodString>;
    mainColorId: z.ZodOptional<z.ZodString>;
    metaTitle: z.ZodOptional<z.ZodString>;
    metaDescription: z.ZodOptional<z.ZodString>;
    categoryIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sizeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    variants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        colorId: z.ZodString;
        sizeId: z.ZodString;
        stockQuantity: z.ZodDefault<z.ZodNumber>;
        price: z.ZodOptional<z.ZodNumber>;
        hasDiscount: z.ZodDefault<z.ZodBoolean>;
        discountPrice: z.ZodOptional<z.ZodNumber>;
        isIndicativePrice: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        colorId: string;
        sizeId: string;
        stockQuantity: number;
        hasDiscount: boolean;
        isIndicativePrice: boolean;
        price?: number | undefined;
        discountPrice?: number | undefined;
    }, {
        colorId: string;
        sizeId: string;
        stockQuantity?: number | undefined;
        price?: number | undefined;
        hasDiscount?: boolean | undefined;
        discountPrice?: number | undefined;
        isIndicativePrice?: boolean | undefined;
    }>, "many">>;
    media: z.ZodOptional<z.ZodArray<z.ZodObject<{
        colorId: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
        mediaType: z.ZodEnum<["image", "video"]>;
        position: z.ZodDefault<z.ZodNumber>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        mediaType: "image" | "video";
        url: string;
        isPrimary: boolean;
        colorId?: string | undefined;
    }, {
        mediaType: "image" | "video";
        url: string;
        position?: number | undefined;
        colorId?: string | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    attributes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attributeDefinitionId: z.ZodString;
        attributeOptionIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }, {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    status: "draft" | "published" | "archived";
    hasDiscount: boolean;
    isIndicativePrice: boolean;
    brandId: string;
    basePrice: number;
    stockStatus: "in_stock" | "by_importation";
    isVisible: boolean;
    description?: string | undefined;
    categoryIds?: string[] | undefined;
    discountPrice?: number | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity: number;
        hasDiscount: boolean;
        isIndicativePrice: boolean;
        price?: number | undefined;
        discountPrice?: number | undefined;
    }[] | undefined;
    media?: {
        position: number;
        mediaType: "image" | "video";
        url: string;
        isPrimary: boolean;
        colorId?: string | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}, {
    name: string;
    slug: string;
    brandId: string;
    basePrice: number;
    description?: string | undefined;
    status?: "draft" | "published" | "archived" | undefined;
    categoryIds?: string[] | undefined;
    hasDiscount?: boolean | undefined;
    discountPrice?: number | undefined;
    isIndicativePrice?: boolean | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    stockStatus?: "in_stock" | "by_importation" | undefined;
    isVisible?: boolean | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity?: number | undefined;
        price?: number | undefined;
        hasDiscount?: boolean | undefined;
        discountPrice?: number | undefined;
        isIndicativePrice?: boolean | undefined;
    }[] | undefined;
    media?: {
        mediaType: "image" | "video";
        url: string;
        position?: number | undefined;
        colorId?: string | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}>;
export declare const CreateProductSchema: z.ZodEffects<z.ZodObject<{
    brandId: z.ZodString;
    collectionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sizeGuideId: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    slug: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    basePrice: z.ZodNumber;
    isIndicativePrice: z.ZodDefault<z.ZodBoolean>;
    hasDiscount: z.ZodDefault<z.ZodBoolean>;
    discountPrice: z.ZodOptional<z.ZodNumber>;
    stockStatus: z.ZodDefault<z.ZodEnum<["in_stock", "by_importation"]>>;
    status: z.ZodDefault<z.ZodEnum<["draft", "published", "archived"]>>;
    isVisible: z.ZodDefault<z.ZodBoolean>;
    keyCharacteristics: z.ZodOptional<z.ZodString>;
    productInfo: z.ZodOptional<z.ZodString>;
    sendPolicy: z.ZodOptional<z.ZodString>;
    returnPolicy: z.ZodOptional<z.ZodString>;
    deliveryEstimate: z.ZodOptional<z.ZodString>;
    supplierLink: z.ZodOptional<z.ZodString>;
    mainColorId: z.ZodOptional<z.ZodString>;
    metaTitle: z.ZodOptional<z.ZodString>;
    metaDescription: z.ZodOptional<z.ZodString>;
    categoryIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sizeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    variants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        colorId: z.ZodString;
        sizeId: z.ZodString;
        stockQuantity: z.ZodDefault<z.ZodNumber>;
        price: z.ZodOptional<z.ZodNumber>;
        hasDiscount: z.ZodDefault<z.ZodBoolean>;
        discountPrice: z.ZodOptional<z.ZodNumber>;
        isIndicativePrice: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        colorId: string;
        sizeId: string;
        stockQuantity: number;
        hasDiscount: boolean;
        isIndicativePrice: boolean;
        price?: number | undefined;
        discountPrice?: number | undefined;
    }, {
        colorId: string;
        sizeId: string;
        stockQuantity?: number | undefined;
        price?: number | undefined;
        hasDiscount?: boolean | undefined;
        discountPrice?: number | undefined;
        isIndicativePrice?: boolean | undefined;
    }>, "many">>;
    media: z.ZodOptional<z.ZodArray<z.ZodObject<{
        colorId: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
        mediaType: z.ZodEnum<["image", "video"]>;
        position: z.ZodDefault<z.ZodNumber>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        mediaType: "image" | "video";
        url: string;
        isPrimary: boolean;
        colorId?: string | undefined;
    }, {
        mediaType: "image" | "video";
        url: string;
        position?: number | undefined;
        colorId?: string | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>;
    attributes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attributeDefinitionId: z.ZodString;
        attributeOptionIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }, {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    status: "draft" | "published" | "archived";
    hasDiscount: boolean;
    isIndicativePrice: boolean;
    brandId: string;
    basePrice: number;
    stockStatus: "in_stock" | "by_importation";
    isVisible: boolean;
    description?: string | undefined;
    categoryIds?: string[] | undefined;
    discountPrice?: number | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity: number;
        hasDiscount: boolean;
        isIndicativePrice: boolean;
        price?: number | undefined;
        discountPrice?: number | undefined;
    }[] | undefined;
    media?: {
        position: number;
        mediaType: "image" | "video";
        url: string;
        isPrimary: boolean;
        colorId?: string | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}, {
    name: string;
    slug: string;
    brandId: string;
    basePrice: number;
    description?: string | undefined;
    status?: "draft" | "published" | "archived" | undefined;
    categoryIds?: string[] | undefined;
    hasDiscount?: boolean | undefined;
    discountPrice?: number | undefined;
    isIndicativePrice?: boolean | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    stockStatus?: "in_stock" | "by_importation" | undefined;
    isVisible?: boolean | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity?: number | undefined;
        price?: number | undefined;
        hasDiscount?: boolean | undefined;
        discountPrice?: number | undefined;
        isIndicativePrice?: boolean | undefined;
    }[] | undefined;
    media?: {
        mediaType: "image" | "video";
        url: string;
        position?: number | undefined;
        colorId?: string | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}>, {
    name: string;
    slug: string;
    status: "draft" | "published" | "archived";
    hasDiscount: boolean;
    isIndicativePrice: boolean;
    brandId: string;
    basePrice: number;
    stockStatus: "in_stock" | "by_importation";
    isVisible: boolean;
    description?: string | undefined;
    categoryIds?: string[] | undefined;
    discountPrice?: number | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity: number;
        hasDiscount: boolean;
        isIndicativePrice: boolean;
        price?: number | undefined;
        discountPrice?: number | undefined;
    }[] | undefined;
    media?: {
        position: number;
        mediaType: "image" | "video";
        url: string;
        isPrimary: boolean;
        colorId?: string | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}, {
    name: string;
    slug: string;
    brandId: string;
    basePrice: number;
    description?: string | undefined;
    status?: "draft" | "published" | "archived" | undefined;
    categoryIds?: string[] | undefined;
    hasDiscount?: boolean | undefined;
    discountPrice?: number | undefined;
    isIndicativePrice?: boolean | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    stockStatus?: "in_stock" | "by_importation" | undefined;
    isVisible?: boolean | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity?: number | undefined;
        price?: number | undefined;
        hasDiscount?: boolean | undefined;
        discountPrice?: number | undefined;
        isIndicativePrice?: boolean | undefined;
    }[] | undefined;
    media?: {
        mediaType: "image" | "video";
        url: string;
        position?: number | undefined;
        colorId?: string | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}>;
export declare const UpdateProductSchema: z.ZodObject<{
    brandId: z.ZodOptional<z.ZodString>;
    collectionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    sizeGuideId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    basePrice: z.ZodOptional<z.ZodNumber>;
    isIndicativePrice: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    hasDiscount: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    discountPrice: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    stockStatus: z.ZodOptional<z.ZodDefault<z.ZodEnum<["in_stock", "by_importation"]>>>;
    status: z.ZodOptional<z.ZodDefault<z.ZodEnum<["draft", "published", "archived"]>>>;
    isVisible: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    keyCharacteristics: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    productInfo: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    sendPolicy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    returnPolicy: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    deliveryEstimate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    supplierLink: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    mainColorId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    metaTitle: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    metaDescription: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    categoryIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    sizeIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    variants: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        colorId: z.ZodString;
        sizeId: z.ZodString;
        stockQuantity: z.ZodDefault<z.ZodNumber>;
        price: z.ZodOptional<z.ZodNumber>;
        hasDiscount: z.ZodDefault<z.ZodBoolean>;
        discountPrice: z.ZodOptional<z.ZodNumber>;
        isIndicativePrice: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        colorId: string;
        sizeId: string;
        stockQuantity: number;
        hasDiscount: boolean;
        isIndicativePrice: boolean;
        price?: number | undefined;
        discountPrice?: number | undefined;
    }, {
        colorId: string;
        sizeId: string;
        stockQuantity?: number | undefined;
        price?: number | undefined;
        hasDiscount?: boolean | undefined;
        discountPrice?: number | undefined;
        isIndicativePrice?: boolean | undefined;
    }>, "many">>>;
    media: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        colorId: z.ZodOptional<z.ZodString>;
        url: z.ZodString;
        mediaType: z.ZodEnum<["image", "video"]>;
        position: z.ZodDefault<z.ZodNumber>;
        isPrimary: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        mediaType: "image" | "video";
        url: string;
        isPrimary: boolean;
        colorId?: string | undefined;
    }, {
        mediaType: "image" | "video";
        url: string;
        position?: number | undefined;
        colorId?: string | undefined;
        isPrimary?: boolean | undefined;
    }>, "many">>>;
    attributes: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodObject<{
        attributeDefinitionId: z.ZodString;
        attributeOptionIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }, {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    slug?: string | undefined;
    description?: string | undefined;
    status?: "draft" | "published" | "archived" | undefined;
    categoryIds?: string[] | undefined;
    hasDiscount?: boolean | undefined;
    discountPrice?: number | undefined;
    isIndicativePrice?: boolean | undefined;
    brandId?: string | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    basePrice?: number | undefined;
    stockStatus?: "in_stock" | "by_importation" | undefined;
    isVisible?: boolean | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity: number;
        hasDiscount: boolean;
        isIndicativePrice: boolean;
        price?: number | undefined;
        discountPrice?: number | undefined;
    }[] | undefined;
    media?: {
        position: number;
        mediaType: "image" | "video";
        url: string;
        isPrimary: boolean;
        colorId?: string | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}, {
    name?: string | undefined;
    slug?: string | undefined;
    description?: string | undefined;
    status?: "draft" | "published" | "archived" | undefined;
    categoryIds?: string[] | undefined;
    hasDiscount?: boolean | undefined;
    discountPrice?: number | undefined;
    isIndicativePrice?: boolean | undefined;
    brandId?: string | undefined;
    collectionIds?: string[] | undefined;
    sizeGuideId?: string | undefined;
    basePrice?: number | undefined;
    stockStatus?: "in_stock" | "by_importation" | undefined;
    isVisible?: boolean | undefined;
    keyCharacteristics?: string | undefined;
    productInfo?: string | undefined;
    sendPolicy?: string | undefined;
    returnPolicy?: string | undefined;
    deliveryEstimate?: string | undefined;
    supplierLink?: string | undefined;
    mainColorId?: string | undefined;
    metaTitle?: string | undefined;
    metaDescription?: string | undefined;
    sizeIds?: string[] | undefined;
    variants?: {
        colorId: string;
        sizeId: string;
        stockQuantity?: number | undefined;
        price?: number | undefined;
        hasDiscount?: boolean | undefined;
        discountPrice?: number | undefined;
        isIndicativePrice?: boolean | undefined;
    }[] | undefined;
    media?: {
        mediaType: "image" | "video";
        url: string;
        position?: number | undefined;
        colorId?: string | undefined;
        isPrimary?: boolean | undefined;
    }[] | undefined;
    attributes?: {
        attributeDefinitionId: string;
        attributeOptionIds: string[];
    }[] | undefined;
}>;
export declare const CreateProductSupplierSchema: z.ZodObject<{
    supplierName: z.ZodString;
    supplierLink: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    contact: z.ZodOptional<z.ZodString>;
    currencyRateId: z.ZodOptional<z.ZodString>;
    supplierPrice: z.ZodNumber;
    priceWithDelivery: z.ZodNumber;
    deliveryTax: z.ZodNumber;
    otherCosts: z.ZodNumber;
    proposedPrice: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    supplierName: string;
    supplierPrice: number;
    priceWithDelivery: number;
    deliveryTax: number;
    otherCosts: number;
    contact?: string | undefined;
    supplierLink?: string | undefined;
    address?: string | undefined;
    currencyRateId?: string | undefined;
    proposedPrice?: number | undefined;
    notes?: string | undefined;
}, {
    supplierName: string;
    supplierPrice: number;
    priceWithDelivery: number;
    deliveryTax: number;
    otherCosts: number;
    contact?: string | undefined;
    supplierLink?: string | undefined;
    address?: string | undefined;
    currencyRateId?: string | undefined;
    proposedPrice?: number | undefined;
    notes?: string | undefined;
}>;
export declare const CreateProductCompetitorSchema: z.ZodObject<{
    link: z.ZodString;
    price: z.ZodNumber;
    comments: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    link: string;
    price: number;
    comments?: string | undefined;
}, {
    link: string;
    price: number;
    comments?: string | undefined;
}>;
export declare const CreateOrderSchema: z.ZodObject<{
    conversationId: z.ZodString;
    userId: z.ZodString;
    proofNotes: z.ZodOptional<z.ZodString>;
    shippingCost: z.ZodDefault<z.ZodNumber>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        productVariantId: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        productVariantId: string;
        quantity: number;
        unitPrice: number;
    }, {
        productId: string;
        productVariantId: string;
        quantity: number;
        unitPrice: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    userId: string;
    conversationId: string;
    shippingCost: number;
    items: {
        productId: string;
        productVariantId: string;
        quantity: number;
        unitPrice: number;
    }[];
    proofNotes?: string | undefined;
}, {
    userId: string;
    conversationId: string;
    items: {
        productId: string;
        productVariantId: string;
        quantity: number;
        unitPrice: number;
    }[];
    proofNotes?: string | undefined;
    shippingCost?: number | undefined;
}>;
export declare const UpdateOrderStatusSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    status: z.ZodEnum<["paid", "in_process", "in_transit", "delivered", "returned", "cancelled"]>;
    shippingCost: z.ZodOptional<z.ZodNumber>;
    proofNotes: z.ZodOptional<z.ZodString>;
    returnReason: z.ZodOptional<z.ZodString>;
    returnProof: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    cancellationReason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "paid" | "in_process" | "in_transit" | "delivered" | "returned" | "cancelled";
    proofNotes?: string | undefined;
    returnReason?: string | undefined;
    returnProof?: string[] | undefined;
    cancellationReason?: string | undefined;
    shippingCost?: number | undefined;
}, {
    status: "paid" | "in_process" | "in_transit" | "delivered" | "returned" | "cancelled";
    proofNotes?: string | undefined;
    returnReason?: string | undefined;
    returnProof?: string[] | undefined;
    cancellationReason?: string | undefined;
    shippingCost?: number | undefined;
}>, {
    status: "paid" | "in_process" | "in_transit" | "delivered" | "returned" | "cancelled";
    proofNotes?: string | undefined;
    returnReason?: string | undefined;
    returnProof?: string[] | undefined;
    cancellationReason?: string | undefined;
    shippingCost?: number | undefined;
}, {
    status: "paid" | "in_process" | "in_transit" | "delivered" | "returned" | "cancelled";
    proofNotes?: string | undefined;
    returnReason?: string | undefined;
    returnProof?: string[] | undefined;
    cancellationReason?: string | undefined;
    shippingCost?: number | undefined;
}>, {
    status: "paid" | "in_process" | "in_transit" | "delivered" | "returned" | "cancelled";
    proofNotes?: string | undefined;
    returnReason?: string | undefined;
    returnProof?: string[] | undefined;
    cancellationReason?: string | undefined;
    shippingCost?: number | undefined;
}, {
    status: "paid" | "in_process" | "in_transit" | "delivered" | "returned" | "cancelled";
    proofNotes?: string | undefined;
    returnReason?: string | undefined;
    returnProof?: string[] | undefined;
    cancellationReason?: string | undefined;
    shippingCost?: number | undefined;
}>;
export declare const UpdateOrderItemSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodNumber>;
    unitPrice: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    quantity?: number | undefined;
    unitPrice?: number | undefined;
}, {
    quantity?: number | undefined;
    unitPrice?: number | undefined;
}>;
export declare const AddToCartSchema: z.ZodObject<{
    productId: z.ZodString;
    productVariantId: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    productVariantId: string;
    quantity: number;
}, {
    productId: string;
    productVariantId: string;
    quantity?: number | undefined;
}>;
export declare const UpdateCartItemSchema: z.ZodObject<{
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    quantity: number;
}, {
    quantity: number;
}>;
export declare const StorySlideInputSchema: z.ZodObject<{
    mediaUrl: z.ZodString;
    mediaType: z.ZodEnum<["image", "video"]>;
    position: z.ZodDefault<z.ZodNumber>;
    productIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    position: number;
    mediaUrl: string;
    mediaType: "image" | "video";
    productIds: string[];
}, {
    mediaUrl: string;
    mediaType: "image" | "video";
    position?: number | undefined;
    productIds?: string[] | undefined;
}>;
export declare const CreateStorySchema: z.ZodObject<{
    name: z.ZodString;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    position: z.ZodDefault<z.ZodNumber>;
    slides: z.ZodArray<z.ZodObject<{
        mediaUrl: z.ZodString;
        mediaType: z.ZodEnum<["image", "video"]>;
        position: z.ZodDefault<z.ZodNumber>;
        productIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        mediaUrl: string;
        mediaType: "image" | "video";
        productIds: string[];
    }, {
        mediaUrl: string;
        mediaType: "image" | "video";
        position?: number | undefined;
        productIds?: string[] | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    position: number;
    slides: {
        position: number;
        mediaUrl: string;
        mediaType: "image" | "video";
        productIds: string[];
    }[];
    thumbnailUrl?: string | undefined;
}, {
    name: string;
    slides: {
        mediaUrl: string;
        mediaType: "image" | "video";
        position?: number | undefined;
        productIds?: string[] | undefined;
    }[];
    position?: number | undefined;
    thumbnailUrl?: string | undefined;
}>;
export declare const UpdateStorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    thumbnailUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    position: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    slides: z.ZodOptional<z.ZodArray<z.ZodObject<{
        mediaUrl: z.ZodString;
        mediaType: z.ZodEnum<["image", "video"]>;
        position: z.ZodDefault<z.ZodNumber>;
        productIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        position: number;
        mediaUrl: string;
        mediaType: "image" | "video";
        productIds: string[];
    }, {
        mediaUrl: string;
        mediaType: "image" | "video";
        position?: number | undefined;
        productIds?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    position?: number | undefined;
    thumbnailUrl?: string | undefined;
    slides?: {
        position: number;
        mediaUrl: string;
        mediaType: "image" | "video";
        productIds: string[];
    }[] | undefined;
}, {
    name?: string | undefined;
    position?: number | undefined;
    thumbnailUrl?: string | undefined;
    slides?: {
        mediaUrl: string;
        mediaType: "image" | "video";
        position?: number | undefined;
        productIds?: string[] | undefined;
    }[] | undefined;
}>;
export declare const CreateMostSearchedSchema: z.ZodObject<{
    categoryId: z.ZodString;
    position: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    position: number;
    categoryId: string;
}, {
    categoryId: string;
    position?: number | undefined;
}>;
export declare const CreateCurrencyRateSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    symbol: z.ZodString;
    rate: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    symbol: string;
    name: string;
    code: string;
    rate: number;
}, {
    symbol: string;
    name: string;
    code: string;
    rate: number;
}>;
export declare const UpdateCurrencyRateSchema: z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    symbol: z.ZodOptional<z.ZodString>;
    rate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    symbol?: string | undefined;
    name?: string | undefined;
    code?: string | undefined;
    rate?: number | undefined;
}, {
    symbol?: string | undefined;
    name?: string | undefined;
    code?: string | undefined;
    rate?: number | undefined;
}>;
export declare const CreateAdminUserSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    roleKey: z.ZodNullable<z.ZodOptional<z.ZodEnum<["super_admin", "admin_no_role_manager", "customer_care", "finance", "product_analyst", "content_manager"]>>>;
    permissions: z.ZodOptional<z.ZodNumber>;
    avatarUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    avatarUrl?: string | null | undefined;
    roleKey?: "super_admin" | "admin_no_role_manager" | "customer_care" | "finance" | "product_analyst" | "content_manager" | null | undefined;
    permissions?: number | undefined;
}, {
    name: string;
    email: string;
    password: string;
    avatarUrl?: string | null | undefined;
    roleKey?: "super_admin" | "admin_no_role_manager" | "customer_care" | "finance" | "product_analyst" | "content_manager" | null | undefined;
    permissions?: number | undefined;
}>;
export declare const UpdateAdminUserSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    roleKey: z.ZodNullable<z.ZodOptional<z.ZodEnum<["super_admin", "admin_no_role_manager", "customer_care", "finance", "product_analyst", "content_manager"]>>>;
    permissions: z.ZodOptional<z.ZodNumber>;
    avatarUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    avatarUrl?: string | null | undefined;
    roleKey?: "super_admin" | "admin_no_role_manager" | "customer_care" | "finance" | "product_analyst" | "content_manager" | null | undefined;
    permissions?: number | undefined;
}, {
    name?: string | undefined;
    avatarUrl?: string | null | undefined;
    roleKey?: "super_admin" | "admin_no_role_manager" | "customer_care" | "finance" | "product_analyst" | "content_manager" | null | undefined;
    permissions?: number | undefined;
}>;
export declare const AdminLoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const FcmTokenSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    newPassword: string;
}, {
    newPassword: string;
}>;
export declare const GoogleAuthSchema: z.ZodObject<{
    idToken: z.ZodString;
}, "strip", z.ZodTypeAny, {
    idToken: string;
}, {
    idToken: string;
}>;
export declare const UpdateContactSchema: z.ZodEffects<z.ZodObject<{
    phone: z.ZodOptional<z.ZodString>;
    whatsappNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    whatsappNumber?: string | undefined;
}, {
    phone?: string | undefined;
    whatsappNumber?: string | undefined;
}>, {
    phone?: string | undefined;
    whatsappNumber?: string | undefined;
}, {
    phone?: string | undefined;
    whatsappNumber?: string | undefined;
}>;
export declare const SendMessageSchema: z.ZodEffects<z.ZodObject<{
    content: z.ZodOptional<z.ZodString>;
    mediaUrl: z.ZodOptional<z.ZodString>;
    mediaType: z.ZodOptional<z.ZodEnum<["image", "video"]>>;
}, "strip", z.ZodTypeAny, {
    content?: string | undefined;
    mediaUrl?: string | undefined;
    mediaType?: "image" | "video" | undefined;
}, {
    content?: string | undefined;
    mediaUrl?: string | undefined;
    mediaType?: "image" | "video" | undefined;
}>, {
    content?: string | undefined;
    mediaUrl?: string | undefined;
    mediaType?: "image" | "video" | undefined;
}, {
    content?: string | undefined;
    mediaUrl?: string | undefined;
    mediaType?: "image" | "video" | undefined;
}>;
export declare const PresignRequestSchema: z.ZodObject<{
    filename: z.ZodString;
    contentType: z.ZodString;
    context: z.ZodEnum<["chat", "product", "story", "brand", "category", "size_guide", "avatar", "collection"]>;
}, "strip", z.ZodTypeAny, {
    filename: string;
    contentType: string;
    context: "category" | "brand" | "collection" | "product" | "story" | "chat" | "size_guide" | "avatar";
}, {
    filename: string;
    contentType: string;
    context: "category" | "brand" | "collection" | "product" | "story" | "chat" | "size_guide" | "avatar";
}>;
export declare const VisitorSessionSchema: z.ZodObject<{
    platform: z.ZodEnum<["web", "ios", "android"]>;
}, "strip", z.ZodTypeAny, {
    platform: "web" | "ios" | "android";
}, {
    platform: "web" | "ios" | "android";
}>;
export declare const Permissions: {
    readonly DASHBOARD_VIEW: number;
    readonly ORDERS_VIEW: number;
    readonly ORDERS_EDIT: number;
    readonly CLIENTS_VIEW: number;
    readonly PRODUCTS_VIEW: number;
    readonly PRODUCTS_CREATE: number;
    readonly PRODUCTS_EDIT: number;
    readonly CATEGORIES_EDIT: number;
    readonly BRANDS_EDIT: number;
    readonly FILTERS_EDIT: number;
    readonly SIZES_EDIT: number;
    readonly COLORS_EDIT: number;
    readonly COLLECTIONS_EDIT: number;
    readonly STORIES_EDIT: number;
    readonly MOST_SEARCHED_EDIT: number;
    readonly CURRENCY_EDIT: number;
    readonly CHATS_VIEW: number;
    readonly ANALYTICS_VIEW: number;
    readonly AUTHORITY_MANAGE: number;
};
export declare const ALL_PERMISSIONS: number;
export declare const MANAGE_STRUCTURE: number;
export declare const MANAGE_PRODUCTS: number;
export declare const hasPermission: (userPermissions: bigint | number, permission: number) => boolean;
export declare const RoleKeySchema: z.ZodEnum<["super_admin", "admin_no_role_manager", "customer_care", "finance", "product_analyst", "content_manager"]>;
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
export declare const SYSTEM_ROLES: {
    key: RoleKey;
    permissions: number;
}[];
export declare function getRoleRules(roleKey: RoleKey): RoleRules;
export declare function getPermissionsForRole(roleKey: RoleKey): number;
export declare function getRoleKeyForPermissions(permissions: bigint | number): RoleKey | null;
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
export type CreateAttributeDefinitionInput = z.infer<typeof CreateAttributeDefinitionSchema>;
export type UpdateAttributeDefinitionInput = z.infer<typeof UpdateAttributeDefinitionSchema>;
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
//# sourceMappingURL=index.d.ts.map