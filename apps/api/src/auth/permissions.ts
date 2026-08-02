import { UserRole } from '../generated/prisma/client';

type ValueOf<T> = T[keyof T];

export const PERMISSIONS = {
  USERS: {
    VIEW_OWN_PROFILE: 'users:view-own-profile',
    UPDATE_OWN_PROFILE: 'users:update-own-profile',
    CHANGE_OWN_PASSWORD: 'users:change-own-password',
    MANAGE: 'users:manage',
    CREATE: 'users:create',
  },
  SALES_EXECUTIVES: {
    VIEW_ACTIVE: 'sales-executives:view-active',
    MANAGE: 'sales-executives:manage',
    CREATE: 'sales-executives:create',
    APPROVE_ONBOARDING: 'sales-executives:approve-onboarding',
    REJECT_ONBOARDING: 'sales-executives:reject-onboarding',
  },
  LEADS: {
    CREATE: 'leads:create',
    VIEW_ALL: 'leads:view-all',
    VIEW_ASSIGNED: 'leads:view-assigned',
    UPDATE_ALL: 'leads:update-all',
    UPDATE_ASSIGNED: 'leads:update-assigned',
    DELETE: 'leads:delete',
    ASSIGN: 'leads:assign',
  },
  CUSTOMERS: {
    CREATE: 'customers:create',
    VIEW_ALL: 'customers:view-all',
    VIEW_ASSIGNED: 'customers:view-assigned',
    UPDATE_ALL: 'customers:update-all',
    UPDATE_ASSIGNED: 'customers:update-assigned',
    DELETE: 'customers:delete',
    ASSIGN: 'customers:assign',
  },
  FOLLOW_UPS: {
    CREATE: 'follow-ups:create',
    VIEW_ALL: 'follow-ups:view-all',
    VIEW_ASSIGNED: 'follow-ups:view-assigned',
    UPDATE_ALL: 'follow-ups:update-all',
    UPDATE_ASSIGNED: 'follow-ups:update-assigned',
    DELETE: 'follow-ups:delete',
    ASSIGN: 'follow-ups:assign',
  },
  SITE_VISITS: {
    CREATE: 'site-visits:create',
    VIEW_ALL: 'site-visits:view-all',
    VIEW_ASSIGNED: 'site-visits:view-assigned',
    UPDATE_ALL: 'site-visits:update-all',
    UPDATE_ASSIGNED: 'site-visits:update-assigned',
    CANCEL: 'site-visits:cancel',
  },
  VEHICLES: {
    VIEW: 'vehicles:view',
    CREATE: 'vehicles:create',
    UPDATE: 'vehicles:update',
  },
  DRIVERS: {
    VIEW: 'drivers:view',
    CREATE: 'drivers:create',
    UPDATE: 'drivers:update',
  },
  PLATFORMS: {
    PLATFORM_CREATE: 'platforms:create',
    PLATFORM_READ: 'platforms:read',
    PLATFORM_UPDATE: 'platforms:update',
  },
  BOOKINGS: {
    CREATE: 'bookings:create',
    VIEW_RECENT: 'bookings:view-recent',
    VIEW_ALL: 'bookings:view-all',
    CANCEL: 'bookings:cancel',
    CLOSE_SALE: 'bookings:close-sale',
  },
  PAYMENTS: {
    CREATE: 'payments:create',
    VIEW: 'payments:view',
  },
  KYC: {
    VIEW: 'kyc:view',
    UPDATE: 'kyc:update',
  },
  PROJECTS: {
    VIEW: 'projects:view',
    CREATE: 'projects:create',
    UPDATE: 'projects:update',
    DELETE: 'projects:delete',
  },
  PLOTS: {
    VIEW: 'plots:view',
    CREATE: 'plots:create',
    UPDATE: 'plots:update',
    UPDATE_STATUS: 'plots:update-status',
  },
  PLOT_BLOCKS: {
    CREATE: 'plot-blocks:create',
    VIEW: 'plot-blocks:view',
    CANCEL: 'plot-blocks:cancel',
  },
  REPORTS: {
    VIEW: 'reports:view',
    EXPORT: 'reports:export',
  },
  DASHBOARD: {
    VIEW_SUMMARY: 'dashboard:view-summary',
    VIEW_OWN_SUMMARY: 'dashboard:view-own-summary',
    VIEW_ADMIN_SUMMARY: 'dashboard:view-admin-summary',
  },
  ACTIVITY_EVENTS: {
    VIEW_ALL: 'activity-events:view-all',
  },
} as const;

export type Permission = ValueOf<{
  [Domain in keyof typeof PERMISSIONS]: ValueOf<(typeof PERMISSIONS)[Domain]>;
}>;

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap((domain) =>
  Object.values(domain),
) as Permission[];

export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: ALL_PERMISSIONS,
  [UserRole.SALES_EXECUTIVE]: [
    PERMISSIONS.USERS.VIEW_OWN_PROFILE,
    PERMISSIONS.USERS.UPDATE_OWN_PROFILE,
    PERMISSIONS.USERS.CHANGE_OWN_PASSWORD,
    PERMISSIONS.LEADS.CREATE,
    PERMISSIONS.LEADS.VIEW_ASSIGNED,
    PERMISSIONS.LEADS.UPDATE_ASSIGNED,
    PERMISSIONS.CUSTOMERS.CREATE,
    PERMISSIONS.CUSTOMERS.VIEW_ASSIGNED,
    PERMISSIONS.CUSTOMERS.UPDATE_ASSIGNED,
    PERMISSIONS.FOLLOW_UPS.CREATE,
    PERMISSIONS.FOLLOW_UPS.VIEW_ASSIGNED,
    PERMISSIONS.FOLLOW_UPS.UPDATE_ASSIGNED,
    PERMISSIONS.SITE_VISITS.CREATE,
    PERMISSIONS.SITE_VISITS.VIEW_ASSIGNED,
    PERMISSIONS.SITE_VISITS.UPDATE_ASSIGNED,
    PERMISSIONS.SITE_VISITS.CANCEL,
    PERMISSIONS.VEHICLES.VIEW,
    PERMISSIONS.DRIVERS.VIEW,
    PERMISSIONS.BOOKINGS.CREATE,
    PERMISSIONS.BOOKINGS.CANCEL,
    PERMISSIONS.BOOKINGS.CLOSE_SALE,
    PERMISSIONS.PAYMENTS.CREATE,
    PERMISSIONS.PAYMENTS.VIEW,
    PERMISSIONS.KYC.VIEW,
    PERMISSIONS.KYC.UPDATE,
    PERMISSIONS.PLATFORMS.PLATFORM_READ,
    PERMISSIONS.PROJECTS.VIEW,
    PERMISSIONS.PLOTS.VIEW,
    PERMISSIONS.PLOT_BLOCKS.CREATE,
    PERMISSIONS.PLOT_BLOCKS.VIEW,
    PERMISSIONS.PLOT_BLOCKS.CANCEL,
    PERMISSIONS.DASHBOARD.VIEW_SUMMARY,
    PERMISSIONS.DASHBOARD.VIEW_OWN_SUMMARY,
  ],
  [UserRole.PROJECT_INVENTORY_MANAGER]: [
    PERMISSIONS.USERS.VIEW_OWN_PROFILE,
    PERMISSIONS.USERS.UPDATE_OWN_PROFILE,
    PERMISSIONS.USERS.CHANGE_OWN_PASSWORD,
    PERMISSIONS.PROJECTS.VIEW,
    PERMISSIONS.PROJECTS.CREATE,
    PERMISSIONS.PROJECTS.UPDATE,
    PERMISSIONS.PLOTS.VIEW,
    PERMISSIONS.PLOTS.CREATE,
    PERMISSIONS.PLOTS.UPDATE,
    PERMISSIONS.PLOTS.UPDATE_STATUS,
    PERMISSIONS.PLOT_BLOCKS.VIEW,
    PERMISSIONS.BOOKINGS.VIEW_RECENT,
    PERMISSIONS.DASHBOARD.VIEW_SUMMARY,
  ],
  [UserRole.SITE_VISIT_COORDINATOR]: [
    PERMISSIONS.USERS.VIEW_OWN_PROFILE,
    PERMISSIONS.USERS.UPDATE_OWN_PROFILE,
    PERMISSIONS.USERS.CHANGE_OWN_PASSWORD,
    PERMISSIONS.SALES_EXECUTIVES.VIEW_ACTIVE,
    PERMISSIONS.CUSTOMERS.CREATE,
    PERMISSIONS.CUSTOMERS.VIEW_ASSIGNED,
    PERMISSIONS.PROJECTS.VIEW,
    PERMISSIONS.SITE_VISITS.CREATE,
    PERMISSIONS.SITE_VISITS.VIEW_ASSIGNED,
    PERMISSIONS.SITE_VISITS.UPDATE_ASSIGNED,
    PERMISSIONS.SITE_VISITS.CANCEL,
    PERMISSIONS.VEHICLES.VIEW,
    PERMISSIONS.VEHICLES.CREATE,
    PERMISSIONS.VEHICLES.UPDATE,
    PERMISSIONS.DRIVERS.VIEW,
    PERMISSIONS.DRIVERS.CREATE,
    PERMISSIONS.DRIVERS.UPDATE,
    PERMISSIONS.DASHBOARD.VIEW_SUMMARY,
  ],
} satisfies Record<UserRole, readonly Permission[]>;

export function getPermissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function userHasPermission(
  role: UserRole,
  permission: Permission,
): boolean {
  if (role === UserRole.ADMIN) {
    return true;
  }

  return getPermissionsForRole(role).includes(permission);
}
