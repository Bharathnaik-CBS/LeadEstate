import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  BookingKycStatus,
  BookingStatus,
  FollowUpStatus,
  LeadStatus,
  OnboardingStatus,
  PaymentStatus,
  PlotBlockStatus,
  PlotStatus,
  SiteVisitStatus,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  let prisma: {
    lead: {
      count: jest.Mock;
      groupBy: jest.Mock;
      findMany: jest.Mock;
    };
    customer: {
      count: jest.Mock;
    };
    booking: {
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    project: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    platform: {
      findMany: jest.Mock;
    };
    plot: {
      groupBy: jest.Mock;
    };
    followUp: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    bookingKyc: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    bookingPayment: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    siteVisit: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    plotBlock: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    activityEvent: {
      findMany: jest.Mock;
    };
  };
  let service: DashboardService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-18T10:00:00.000Z'));
    prisma = {
      lead: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      customer: {
        count: jest.fn(),
      },
      booking: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      project: {
        count: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      platform: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      plot: {
        groupBy: jest.fn(),
      },
      followUp: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      bookingKyc: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      bookingPayment: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      siteVisit: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      plotBlock: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      activityEvent: {
        findMany: jest.fn(),
      },
    };
    service = new DashboardService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns admin generatedAt, totals, breakdowns, and pending actions', async () => {
    prisma.lead.count.mockResolvedValue(10);
    prisma.customer.count.mockResolvedValue(7);
    prisma.booking.count.mockResolvedValue(5);
    prisma.project.count.mockResolvedValue(3);
    prisma.lead.groupBy.mockResolvedValue([
      { status: LeadStatus.NEW, _count: { _all: 4 } },
    ]);
    prisma.booking.groupBy.mockResolvedValue([
      { status: BookingStatus.ACTIVE, _count: { _all: 2 } },
    ]);
    prisma.plot.groupBy.mockResolvedValue([
      { status: PlotStatus.AVAILABLE, _count: { _all: 8 } },
    ]);
    prisma.followUp.count.mockResolvedValue(1);
    prisma.bookingKyc.count.mockResolvedValue(2);
    prisma.bookingPayment.count.mockResolvedValue(3);
    prisma.siteVisit.count.mockResolvedValue(4);
    prisma.plotBlock.count.mockResolvedValue(5);

    await expect(service.getAdminSummary()).resolves.toMatchObject({
      generatedAt: '2026-05-18T10:00:00.000Z',
      totals: {
        leads: 10,
        customers: 7,
        bookings: 5,
        projects: 3,
      },
      breakdowns: {
        leadsByStatus: {
          [LeadStatus.NEW]: 4,
          [LeadStatus.CANCELLED]: 0,
        },
        bookingsByStatus: {
          [BookingStatus.ACTIVE]: 2,
          [BookingStatus.CANCELLED]: 0,
        },
        plotsByStatus: {
          [PlotStatus.AVAILABLE]: 8,
          [PlotStatus.BOOKED]: 0,
        },
      },
      pendingActions: {
        followUpsDue: 1,
        kycPending: 2,
        paymentPending: 3,
        siteVisitsUpcoming: 4,
        plotBlocksExpiring: 5,
      },
    });
  });

  it('caps pending actions take at 50', async () => {
    prisma.followUp.findMany.mockResolvedValue([]);
    prisma.bookingKyc.findMany.mockResolvedValue([]);
    prisma.bookingPayment.findMany.mockResolvedValue([]);
    prisma.siteVisit.findMany.mockResolvedValue([]);
    prisma.plotBlock.findMany.mockResolvedValue([]);

    await service.getPendingActions('100');

    expect(prisma.followUp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
    expect(prisma.bookingKyc.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
    expect(prisma.bookingPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
    expect(prisma.siteVisit.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
    expect(prisma.plotBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('fetches take plus one recent activity events and returns nextCursor', async () => {
    prisma.activityEvent.findMany.mockResolvedValue([
      createActivityEvent('event-1'),
      createActivityEvent('event-2'),
      createActivityEvent('event-3'),
    ]);

    await expect(service.getRecentActivity('2')).resolves.toEqual({
      items: [
        {
          id: 'event-1',
          action: 'lead.created',
          targetType: 'Lead',
          targetId: 'target-1',
          occurredAt: '2026-05-18T09:00:00.000Z',
          actor: {
            id: 'user-1',
            name: 'Sales One',
            email: 'sales@example.com',
            role: UserRole.SALES_EXECUTIVE,
          },
          metadata: {
            targetName: 'Lead One',
          },
        },
        {
          id: 'event-2',
          action: 'lead.created',
          targetType: 'Lead',
          targetId: 'target-1',
          occurredAt: '2026-05-18T09:00:00.000Z',
          actor: {
            id: 'user-1',
            name: 'Sales One',
            email: 'sales@example.com',
            role: UserRole.SALES_EXECUTIVE,
          },
          metadata: {
            targetName: 'Lead One',
          },
        },
      ],
      nextCursor: 'event-2',
    });

    expect(prisma.activityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 3,
        select: expect.objectContaining({
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        }),
      }),
    );
  });

  it('scopes sales summary queries to the current user id', async () => {
    prisma.lead.count.mockResolvedValue(4);
    prisma.customer.count.mockResolvedValue(3);
    prisma.booking.count.mockResolvedValue(2);
    prisma.siteVisit.count.mockResolvedValueOnce(1).mockResolvedValueOnce(5);
    prisma.followUp.count.mockResolvedValue(6);
    prisma.bookingKyc.count.mockResolvedValue(7);
    prisma.bookingPayment.count.mockResolvedValue(8);
    prisma.plotBlock.count.mockResolvedValue(9);
    prisma.lead.groupBy.mockResolvedValue([
      { status: LeadStatus.FOLLOW_UP, _count: { _all: 4 } },
    ]);
    prisma.booking.groupBy.mockResolvedValue([
      { status: BookingStatus.ACTIVE, _count: { _all: 2 } },
    ]);

    await service.getSalesSummary(salesUser);

    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: {
        assignedToId: salesUser.userId,
      },
    });
    expect(prisma.customer.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { assignedToId: salesUser.userId },
          { createdById: salesUser.userId },
        ],
      },
    });
    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        salesExecutiveId: salesUser.userId,
      },
    });
    expect(prisma.bookingKyc.count).toHaveBeenCalledWith({
      where: {
        status: BookingKycStatus.PENDING,
        booking: {
          salesExecutiveId: salesUser.userId,
        },
      },
    });
    expect(prisma.bookingPayment.count).toHaveBeenCalledWith({
      where: {
        status: PaymentStatus.PENDING,
        booking: {
          salesExecutiveId: salesUser.userId,
        },
      },
    });
    expect(prisma.plotBlock.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          blockedById: salesUser.userId,
          status: PlotBlockStatus.ACTIVE,
        }),
      }),
    );
    expect(prisma.followUp.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { assignedToId: salesUser.userId },
            { createdById: salesUser.userId },
          ],
          status: FollowUpStatus.PENDING,
        }),
      }),
    );
    expect(prisma.siteVisit.count).toHaveBeenNthCalledWith(1, {
      where: {
        OR: [
          { assignedToId: salesUser.userId },
          { createdById: salesUser.userId },
        ],
      },
    });
    expect(prisma.siteVisit.count).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { assignedToId: salesUser.userId },
            { createdById: salesUser.userId },
          ],
          status: SiteVisitStatus.SCHEDULED,
        }),
      }),
    );
    expect(prisma.lead.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assignedToId: salesUser.userId,
        },
      }),
    );
    expect(prisma.booking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          salesExecutiveId: salesUser.userId,
        },
      }),
    );
  });

  const salesUser = {
    userId: 'sales-1',
    email: 'sales@example.com',
    role: UserRole.SALES_EXECUTIVE,
    onboardingStatus: OnboardingStatus.ACTIVE,
  } satisfies AuthenticatedUser;

  function createActivityEvent(id: string) {
    return {
      id,
      action: 'lead.created',
      targetType: 'Lead',
      targetId: 'target-1',
      occurredAt: new Date('2026-05-18T09:00:00.000Z'),
      actor: {
        id: 'user-1',
        name: 'Sales One',
        email: 'sales@example.com',
        role: UserRole.SALES_EXECUTIVE,
      },
      metadata: {
        targetName: 'Lead One',
      },
    };
  }
});
