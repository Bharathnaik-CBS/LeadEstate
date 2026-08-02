import { UserRole } from '../generated/prisma/client';
import {
  ALL_PERMISSIONS,
  getPermissionsForRole,
  PERMISSIONS,
  userHasPermission,
} from './permissions';

describe('permissions framework', () => {
  it('gives ADMIN every permission and treats ADMIN as a super role', () => {
    expect(getPermissionsForRole(UserRole.ADMIN)).toEqual(ALL_PERMISSIONS);

    for (const permission of ALL_PERMISSIONS) {
      expect(userHasPermission(UserRole.ADMIN, permission)).toBe(true);
    }
  });

  it('gives SALES_EXECUTIVE only mapped SE-safe permissions', () => {
    const permissions = getPermissionsForRole(UserRole.SALES_EXECUTIVE);

    expect(permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.USERS.VIEW_OWN_PROFILE,
        PERMISSIONS.USERS.UPDATE_OWN_PROFILE,
        PERMISSIONS.USERS.CHANGE_OWN_PASSWORD,
        PERMISSIONS.LEADS.CREATE,
        PERMISSIONS.LEADS.VIEW_ASSIGNED,
        PERMISSIONS.LEADS.UPDATE_ASSIGNED,
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
        PERMISSIONS.DASHBOARD.VIEW_OWN_SUMMARY,
      ]),
    );
    expect(permissions).not.toEqual(
      expect.arrayContaining([
        PERMISSIONS.SALES_EXECUTIVES.MANAGE,
        PERMISSIONS.LEADS.DELETE,
        PERMISSIONS.LEADS.ASSIGN,
        PERMISSIONS.BOOKINGS.VIEW_RECENT,
        PERMISSIONS.SITE_VISITS.VIEW_ALL,
        PERMISSIONS.SITE_VISITS.UPDATE_ALL,
        PERMISSIONS.VEHICLES.CREATE,
        PERMISSIONS.VEHICLES.UPDATE,
        PERMISSIONS.DRIVERS.CREATE,
        PERMISSIONS.DRIVERS.UPDATE,
        PERMISSIONS.PLATFORMS.PLATFORM_CREATE,
        PERMISSIONS.PLATFORMS.PLATFORM_UPDATE,
        PERMISSIONS.PROJECTS.CREATE,
        PERMISSIONS.REPORTS.VIEW,
        PERMISSIONS.REPORTS.EXPORT,
        PERMISSIONS.ACTIVITY_EVENTS.VIEW_ALL,
      ]),
    );
  });

  it('returns false when a role is missing a permission', () => {
    expect(
      userHasPermission(
        UserRole.SALES_EXECUTIVE,
        PERMISSIONS.SALES_EXECUTIVES.MANAGE,
      ),
    ).toBe(false);
  });

  it('maps PIM permissions to project and inventory work', () => {
    const permissions = getPermissionsForRole(
      UserRole.PROJECT_INVENTORY_MANAGER,
    );

    expect(permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.USERS.VIEW_OWN_PROFILE,
        PERMISSIONS.PROJECTS.VIEW,
        PERMISSIONS.PROJECTS.CREATE,
        PERMISSIONS.PROJECTS.UPDATE,
        PERMISSIONS.PLOTS.VIEW,
        PERMISSIONS.PLOTS.CREATE,
        PERMISSIONS.PLOTS.UPDATE_STATUS,
        PERMISSIONS.PLOT_BLOCKS.VIEW,
        PERMISSIONS.DASHBOARD.VIEW_SUMMARY,
      ]),
    );
    expect(permissions).not.toEqual(
      expect.arrayContaining([
        PERMISSIONS.LEADS.DELETE,
        PERMISSIONS.SITE_VISITS.CREATE,
        PERMISSIONS.USERS.CREATE,
        PERMISSIONS.PROJECTS.DELETE,
      ]),
    );
  });

  it('maps SVC permissions to assigned visits and transport lists', () => {
    const permissions = getPermissionsForRole(UserRole.SITE_VISIT_COORDINATOR);

    expect(permissions).toEqual(
      expect.arrayContaining([
        PERMISSIONS.USERS.VIEW_OWN_PROFILE,
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
      ]),
    );
    expect(permissions).not.toEqual(
      expect.arrayContaining([
        PERMISSIONS.LEADS.DELETE,
        PERMISSIONS.PROJECTS.CREATE,
        PERMISSIONS.PLOTS.UPDATE,
        PERMISSIONS.ACTIVITY_EVENTS.VIEW_ALL,
        PERMISSIONS.USERS.CREATE,
      ]),
    );
  });
});
