import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  FollowUpStatus,
  OnboardingStatus,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { FollowUpsService } from './follow-ups.service';

describe('FollowUpsService activity events', () => {
  let prisma: {
    followUp: {
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
  let service: FollowUpsService;

  beforeEach(() => {
    prisma = {
      followUp: {
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
    service = new FollowUpsService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('logs follow_up.created after creating a follow-up', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'sales-1',
      role: UserRole.SALES_EXECUTIVE,
    });
    prisma.followUp.create.mockResolvedValue(createFollowUp());

    await service.create(
      {
        dueAt: '2026-05-18T10:00:00.000Z',
        leadId: 'lead-1',
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'follow_up.created',
      targetType: 'FollowUp',
      targetId: 'follow-up-1',
      actorId: 'sales-1',
      metadata: {
        followUpId: 'follow-up-1',
        leadId: 'lead-1',
        customerId: null,
        assignedToId: 'sales-1',
        status: FollowUpStatus.PENDING,
        dueAt: '2026-05-18T10:00:00.000Z',
        completedAt: null,
      },
    });
  });

  it('logs follow_up.updated after updating a follow-up without lifecycle transition', async () => {
    prisma.followUp.findUnique.mockResolvedValue(createFollowUp());
    prisma.followUp.update.mockResolvedValue(
      createFollowUp({
        dueAt: new Date('2026-05-19T10:00:00.000Z'),
      }),
    );

    await service.update(
      'follow-up-1',
      {
        dueAt: '2026-05-19T10:00:00.000Z',
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'follow_up.updated',
      targetType: 'FollowUp',
      targetId: 'follow-up-1',
      actorId: 'sales-1',
      metadata: {
        followUpId: 'follow-up-1',
        leadId: 'lead-1',
        customerId: null,
        assignedToId: 'sales-1',
        status: FollowUpStatus.PENDING,
        dueAt: '2026-05-19T10:00:00.000Z',
        completedAt: null,
      },
    });
  });

  it('logs follow_up.completed after completing a follow-up', async () => {
    prisma.followUp.findUnique.mockResolvedValue(createFollowUp());
    prisma.followUp.update.mockResolvedValue(
      createFollowUp({
        status: FollowUpStatus.COMPLETED,
        completedAt: new Date('2026-05-18T11:00:00.000Z'),
      }),
    );

    await service.update(
      'follow-up-1',
      {
        status: FollowUpStatus.COMPLETED,
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'follow_up.completed',
      targetType: 'FollowUp',
      targetId: 'follow-up-1',
      actorId: 'sales-1',
      metadata: {
        followUpId: 'follow-up-1',
        leadId: 'lead-1',
        customerId: null,
        assignedToId: 'sales-1',
        status: FollowUpStatus.COMPLETED,
        dueAt: '2026-05-18T10:00:00.000Z',
        completedAt: '2026-05-18T11:00:00.000Z',
        previousStatus: FollowUpStatus.PENDING,
      },
    });
  });

  it('logs follow_up.cancelled after cancelling a follow-up', async () => {
    prisma.followUp.findUnique.mockResolvedValue(createFollowUp());
    prisma.followUp.update.mockResolvedValue(
      createFollowUp({
        status: FollowUpStatus.CANCELLED,
      }),
    );

    await service.update(
      'follow-up-1',
      {
        status: FollowUpStatus.CANCELLED,
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'follow_up.cancelled',
      targetType: 'FollowUp',
      targetId: 'follow-up-1',
      actorId: 'sales-1',
      metadata: {
        followUpId: 'follow-up-1',
        leadId: 'lead-1',
        customerId: null,
        assignedToId: 'sales-1',
        status: FollowUpStatus.CANCELLED,
        dueAt: '2026-05-18T10:00:00.000Z',
        completedAt: null,
        previousStatus: FollowUpStatus.PENDING,
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

  function createFollowUp(
    overrides: Partial<{
      assignedToId: string | null;
      status: FollowUpStatus;
      dueAt: Date;
      completedAt: Date | null;
    }> = {},
  ) {
    return {
      id: 'follow-up-1',
      dueAt: new Date('2026-05-18T10:00:00.000Z'),
      status: FollowUpStatus.PENDING,
      notes: null,
      completedAt: null,
      leadId: 'lead-1',
      customerId: null,
      assignedToId: 'sales-1',
      createdById: 'sales-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
