import {
  Permissions,
  SYSTEM_ROLES,
  getRoleRules,
  getRoleKeyForPermissions,
  hasPermission,
  type RoleKey,
} from "@ecommerce/types";

type AdminAccessUser = {
  permissions: number;
  roleKey?: RoleKey | null;
} | null;

const ROLE_PRESENTATION: Record<
  RoleKey,
  { label: string; description: string }
> = {
  super_admin: {
    label: "Super Admin",
    description: "Acesso total a todas as áreas e operações do painel.",
  },
  admin_no_role_manager: {
    label: "Admin Sem Gestão de Roles",
    description:
      "Opera quase todo o painel, mas não cria nem gere acessos administrativos.",
  },
  customer_care: {
    label: "Customer Care",
    description:
      "Atende chats e gere encomendas sem poder marcar pagamento como confirmado.",
  },
  finance: {
    label: "Finance",
    description:
      "Acompanha dashboard, vê encomendas e confirma pagamentos e câmbio.",
  },
  product_analyst: {
    label: "Product Analyst",
    description:
      "Gere catálogo e estrutura, mas os produtos ficam ocultos até revisão final.",
  },
  content_manager: {
    label: "Content Manager",
    description: "Gere stories e acompanha produtos em modo de leitura.",
  },
};

export const SYSTEM_ROLE_OPTIONS = SYSTEM_ROLES.map((role) => ({
  roleKey: role.key,
  label: ROLE_PRESENTATION[role.key].label,
  description: ROLE_PRESENTATION[role.key].description,
}));

export function resolveAdminRoleKey(user: AdminAccessUser): RoleKey | null {
  if (!user) {
    return null;
  }

  if (user.roleKey) {
    return user.roleKey;
  }

  return getRoleKeyForPermissions(user.permissions);
}

export function getAdminRolePresentation(user: AdminAccessUser) {
  const roleKey = resolveAdminRoleKey(user);
  if (!roleKey) {
    return null;
  }

  return {
    roleKey,
    ...ROLE_PRESENTATION[roleKey],
  };
}

export function hasAdminPermission(
  user: AdminAccessUser,
  permission: number,
): boolean {
  return hasPermission(user?.permissions ?? 0, permission);
}

export function canManageAuthority(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.AUTHORITY_MANAGE);
}

export function canViewDashboard(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.DASHBOARD_VIEW);
}

export function canViewOrders(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.ORDERS_VIEW);
}

export function canViewClients(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.CLIENTS_VIEW);
}

export function canViewChats(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.CHATS_VIEW);
}

export function canViewProducts(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.PRODUCTS_VIEW);
}

export function canViewAnalytics(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.ANALYTICS_VIEW);
}

export function canManageCategories(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.CATEGORIES_EDIT);
}

export function canManageBrands(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.BRANDS_EDIT);
}

export function canManageFilters(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.FILTERS_EDIT);
}

export function canManageSizes(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.SIZES_EDIT);
}

export function canManageColors(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.COLORS_EDIT);
}

export function canManageCollections(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.COLLECTIONS_EDIT);
}

export function canManageStories(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.STORIES_EDIT);
}

export function canManageMostSearched(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.MOST_SEARCHED_EDIT);
}

export function canCreateProducts(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.PRODUCTS_CREATE);
}

export function canEditProducts(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.PRODUCTS_EDIT);
}

export function forcesHiddenProductSave(user: AdminAccessUser): boolean {
  const roleKey = resolveAdminRoleKey(user);
  if (!roleKey) {
    return false;
  }

  return getRoleRules(roleKey).forceProductVisibilityFalseOnSave;
}

export function canEditSpecificProduct(
  user: AdminAccessUser,
  isVisible: boolean,
): boolean {
  if (!canEditProducts(user)) {
    return false;
  }

  const roleKey = resolveAdminRoleKey(user);
  if (!roleKey) {
    return true;
  }

  const rules = getRoleRules(roleKey);
  return !isVisible || rules.canEditVisibleProducts;
}

export function canManageCurrencies(user: AdminAccessUser): boolean {
  return hasAdminPermission(user, Permissions.CURRENCY_EDIT);
}

export function canEditPendingOrderDetails(user: AdminAccessUser): boolean {
  const roleKey = resolveAdminRoleKey(user);
  if (!roleKey) {
    return hasAdminPermission(user, Permissions.ORDERS_EDIT);
  }

  return (
    hasAdminPermission(user, Permissions.ORDERS_EDIT) &&
    getRoleRules(roleKey).canEditOrderItems
  );
}

export function canTransitionOrderToStatus(
  user: AdminAccessUser,
  status: string,
): boolean {
  if (!hasAdminPermission(user, Permissions.ORDERS_EDIT)) {
    return false;
  }

  const roleKey = resolveAdminRoleKey(user);
  if (!roleKey) {
    return true;
  }

  const rules = getRoleRules(roleKey);
  if (status === "paid") {
    return rules.canMarkOrderPaid;
  }

  return rules.canUpdateOrderStatusesExceptPaid;
}