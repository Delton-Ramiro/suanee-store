import {
  getPermissionsForRole,
  getRoleKeyForPermissions,
  getRoleRules,
  RoleKeySchema,
  type RoleKey,
} from "@ecommerce/types";

type AdminRoleSource = {
  roleKey?: string | null;
  permissions?: bigint | number | null;
};

export function resolveAdminRoleKey(admin: AdminRoleSource): RoleKey | null {
  const parsedRoleKey = RoleKeySchema.safeParse(admin.roleKey);
  if (parsedRoleKey.success) {
    return parsedRoleKey.data;
  }

  if (admin.roleKey !== null && admin.roleKey !== undefined) {
    console.warn(
      `[auth] Unrecognised roleKey in DB: "${admin.roleKey}". Falling back to bitmask lookup.`,
    );
  }

  if (admin.permissions === undefined || admin.permissions === null) {
    return null;
  }

  return getRoleKeyForPermissions(admin.permissions);
}

export function resolveAdminPermissions(admin: AdminRoleSource): number {
  const roleKey = resolveAdminRoleKey(admin);
  if (roleKey) {
    return getPermissionsForRole(roleKey);
  }

  return Number(admin.permissions ?? 0);
}

export function resolveAdminRoleAssignment(
  input: { roleKey?: RoleKey | null; permissions?: number },
  fallbackPermissions?: number,
): { roleKey?: RoleKey | null; permissions?: number } {
  if (input.roleKey !== undefined && input.roleKey !== null) {
    return {
      roleKey: input.roleKey,
      permissions: getPermissionsForRole(input.roleKey),
    };
  }

  const permissions = input.permissions ?? fallbackPermissions;
  if (permissions === undefined) {
    return {};
  }

  if (input.roleKey === null) {
    return { roleKey: null, permissions };
  }

  return {
    roleKey: getRoleKeyForPermissions(permissions),
    permissions,
  };
}

export function canCreateAdminOrder(roleKey: RoleKey | null): boolean {
  if (!roleKey) return true;
  return getRoleRules(roleKey).canCreateOrder;
}

export function canEditAdminOrderDetails(roleKey: RoleKey | null): boolean {
  if (!roleKey) return true;
  return getRoleRules(roleKey).canEditOrderItems;
}

export function canTransitionOrderToStatus(
  roleKey: RoleKey | null,
  status: string,
): boolean {
  if (!roleKey) {
    return true;
  }

  const rules = getRoleRules(roleKey);
  if (status === "paid") {
    return rules.canMarkOrderPaid;
  }

  if (rules.canSetAnyOrderStatusExceptPaid) {
    return true;
  }

  if (rules.canOnlyCancelOrders && status !== "cancelled") {
    return false;
  }

  return rules.canUpdateOrderStatusesExceptPaid;
}

export function canEditProduct(
  roleKey: RoleKey | null,
  isVisible: boolean,
): boolean {
  if (!roleKey) {
    return true;
  }

  const rules = getRoleRules(roleKey);
  if (isVisible && !rules.canEditVisibleProducts) {
    return false;
  }

  return true;
}

export function canDeleteProduct(roleKey: RoleKey | null): boolean {
  if (!roleKey) {
    return true;
  }

  return getRoleRules(roleKey).canDeleteProduct;
}

export function canChangeProductVisibility(roleKey: RoleKey | null): boolean {
  if (!roleKey) return true;
  return getRoleRules(roleKey).canChangeProductVisibility;
}

export function getEffectiveProductWriteValues(
  roleKey: RoleKey | null,
  values: { status?: string; isVisible?: boolean },
): { status?: string; isVisible?: boolean } {
  const resolvedValues = { ...values };

  if (roleKey) {
    const rules = getRoleRules(roleKey);

    if (!rules.canPublishProductStatus && resolvedValues.status === "published") {
      resolvedValues.status = "draft";
    }

    if (
      rules.forceProductVisibilityFalseOnSave &&
      (resolvedValues.isVisible === undefined || resolvedValues.isVisible)
    ) {
      resolvedValues.isVisible = false;
    }
  }

  return resolvedValues;
}