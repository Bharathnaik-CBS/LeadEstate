import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  CustomerJourneyStatus,
  OnboardingStatus,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';

describe('CustomersService activity events', () => {
  let prisma: {
    customer: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let activityEventsService: {
    log: jest.Mock;
  };
  let service: CustomersService;

  beforeEach(() => {
    prisma = {
      customer: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    activityEventsService = {
      log: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    service = new CustomersService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('logs customer.created after creating a customer', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'sales-1',
      role: UserRole.SALES_EXECUTIVE,
    });
    prisma.customer.create.mockResolvedValue(createCustomer());

    await service.create(
      {
        fullName: 'Buyer One',
        phone: '9876543210',
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'customer.created',
      targetType: 'Customer',
      targetId: 'customer-1',
      actorId: 'sales-1',
      metadata: {
        customerId: 'customer-1',
        assignedToId: 'sales-1',
        status: CustomerJourneyStatus.PROSPECT,
      },
    });
  });

  it('logs customer.updated with status and assignment changes', async () => {
    prisma.customer.findUnique.mockResolvedValue(
      createCustomer({
        assignedToId: 'sales-1',
        status: CustomerJourneyStatus.PROSPECT,
      }),
    );
    prisma.user.findUnique.mockResolvedValue({
      id: 'sales-2',
      role: UserRole.SALES_EXECUTIVE,
    });
    prisma.customer.update.mockResolvedValue(
      createCustomer({
        assignedToId: 'sales-2',
        status: CustomerJourneyStatus.CUSTOMER,
      }),
    );

    await service.update(
      'customer-1',
      {
        assignedToId: 'sales-2',
        status: CustomerJourneyStatus.CUSTOMER,
      },
      createUser('admin-1', UserRole.ADMIN),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'customer.updated',
      targetType: 'Customer',
      targetId: 'customer-1',
      actorId: 'admin-1',
      metadata: {
        customerId: 'customer-1',
        assignedToId: 'sales-2',
        status: CustomerJourneyStatus.CUSTOMER,
        previousStatus: CustomerJourneyStatus.PROSPECT,
        previousAssignedToId: 'sales-1',
      },
    });
  });

  function createUser(userId: string, role: UserRole): AuthenticatedUser {
    return {
      userId,
      email: `${userId}@example.com`,
      role,
      onboardingStatus: OnboardingStatus.ACTIVE,
    };
  }

  function createCustomer(
    overrides: Partial<{
      assignedToId: string | null;
      status: CustomerJourneyStatus;
    }> = {},
  ) {
    return {
      id: 'customer-1',
      fullName: 'Buyer One',
      phone: '9876543210',
      email: null,
      status: CustomerJourneyStatus.PROSPECT,
      notes: null,
      convertedAt: null,
      sourceLeadId: null,
      assignedToId: 'sales-1',
      createdById: 'sales-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
