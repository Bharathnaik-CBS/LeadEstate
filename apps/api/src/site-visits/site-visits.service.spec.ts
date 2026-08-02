import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  OnboardingStatus,
  SiteVisitStatus,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { SiteVisitsService } from './site-visits.service';

describe('SiteVisitsService', () => {
  let prisma: {
    siteVisit: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    lead: {
      findUnique: jest.Mock;
    };
    customer: {
      findUnique: jest.Mock;
    };
    project: {
      findUnique: jest.Mock;
    };
    booking: {
      findUnique: jest.Mock;
    };
    vehicle: {
      findUnique: jest.Mock;
    };
    driver: {
      findUnique: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let activityEventsService: {
    log: jest.Mock;
  };
  let service: SiteVisitsService;

  beforeEach(() => {
    prisma = {
      siteVisit: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      lead: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
      },
      vehicle: {
        findUnique: jest.fn(),
      },
      driver: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    activityEventsService = {
      log: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    service = new SiteVisitsService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('requires a lead or customer when creating a site visit', async () => {
    await expect(
      service.create(
        {
          scheduledAt: '2026-05-18T10:00:00.000Z',
        },
        createUser('sales-1', UserRole.SALES_EXECUTIVE),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects inactive vehicle assignment', async () => {
    prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      isActive: false,
    });

    await expect(
      service.create(
        {
          scheduledAt: '2026-05-18T10:00:00.000Z',
          leadId: 'lead-1',
          vehicleId: 'vehicle-1',
        },
        createUser('sales-1', UserRole.SALES_EXECUTIVE),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects inactive driver assignment', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.driver.findUnique.mockResolvedValue({
      id: 'driver-1',
      isActive: false,
    });

    await expect(
      service.create(
        {
          scheduledAt: '2026-05-18T10:00:00.000Z',
          customerId: 'customer-1',
          driverId: 'driver-1',
        },
        createUser('sales-1', UserRole.SALES_EXECUTIVE),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects normal updates for completed visits', async () => {
    prisma.siteVisit.findUnique.mockResolvedValue({
      id: 'visit-1',
      status: SiteVisitStatus.COMPLETED,
      assignedToId: 'sales-1',
      createdById: null,
    });

    await expect(
      service.update(
        'visit-1',
        {
          notes: 'Updated notes',
        },
        createUser('sales-1', UserRole.SALES_EXECUTIVE),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid lifecycle transitions', async () => {
    prisma.siteVisit.findUnique.mockResolvedValue({
      id: 'visit-1',
      status: SiteVisitStatus.STARTED,
      assignedToId: 'sales-1',
      createdById: null,
    });

    await expect(
      service.start('visit-1', createUser('sales-1', UserRole.SALES_EXECUTIVE)),
    ).rejects.toThrow(BadRequestException);
  });

  it('denies sales executives access to unrelated visits', async () => {
    prisma.siteVisit.findUnique.mockResolvedValue({
      id: 'visit-1',
      status: SiteVisitStatus.SCHEDULED,
      assignedToId: 'sales-2',
      createdById: 'sales-3',
    });

    await expect(
      service.findOne(
        'visit-1',
        createUser('sales-1', UserRole.SALES_EXECUTIVE),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('logs site_visit.created after creating a site visit', async () => {
    prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
    prisma.project.findUnique.mockResolvedValue({ id: 'project-1' });
    prisma.booking.findUnique.mockResolvedValue({ id: 'booking-1' });
    prisma.vehicle.findUnique.mockResolvedValue({
      id: 'vehicle-1',
      isActive: true,
    });
    prisma.driver.findUnique.mockResolvedValue({
      id: 'driver-1',
      isActive: true,
    });
    prisma.siteVisit.create.mockResolvedValue(
      createSiteVisit(SiteVisitStatus.SCHEDULED),
    );

    await service.create(
      {
        scheduledAt: '2026-05-18T10:00:00.000Z',
        leadId: 'lead-1',
        projectId: 'project-1',
        bookingId: 'booking-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'site_visit.created',
      targetType: 'SiteVisit',
      targetId: 'visit-1',
      actorId: 'sales-1',
      metadata: {
        siteVisitId: 'visit-1',
        leadId: 'lead-1',
        customerId: null,
        projectId: 'project-1',
        bookingId: 'booking-1',
        assignedToId: 'sales-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        scheduledAt: '2026-05-18T10:00:00.000Z',
        status: SiteVisitStatus.SCHEDULED,
      },
    });
  });

  it('logs site_visit.started after starting a site visit', async () => {
    prisma.siteVisit.findUnique
      .mockResolvedValueOnce({
        id: 'visit-1',
        status: SiteVisitStatus.SCHEDULED,
        assignedToId: 'sales-1',
        createdById: null,
      })
      .mockResolvedValueOnce(createSiteVisit(SiteVisitStatus.STARTED));
    prisma.siteVisit.updateMany.mockResolvedValue({ count: 1 });

    await service.start(
      'visit-1',
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'site_visit.started',
      targetType: 'SiteVisit',
      targetId: 'visit-1',
      actorId: 'sales-1',
      metadata: {
        siteVisitId: 'visit-1',
        leadId: 'lead-1',
        customerId: null,
        projectId: 'project-1',
        bookingId: 'booking-1',
        assignedToId: 'sales-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        scheduledAt: '2026-05-18T10:00:00.000Z',
        status: SiteVisitStatus.STARTED,
      },
    });
  });

  it('logs site_visit.completed with outcome notes after completing a site visit', async () => {
    prisma.siteVisit.findUnique
      .mockResolvedValueOnce({
        id: 'visit-1',
        status: SiteVisitStatus.STARTED,
        assignedToId: 'sales-1',
        createdById: null,
      })
      .mockResolvedValueOnce(
        createSiteVisit(SiteVisitStatus.COMPLETED, {
          outcomeNotes: 'Customer liked the corner plot',
        }),
      );
    prisma.siteVisit.updateMany.mockResolvedValue({ count: 1 });

    await service.complete(
      'visit-1',
      {
        outcomeNotes: 'Customer liked the corner plot',
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'site_visit.completed',
      targetType: 'SiteVisit',
      targetId: 'visit-1',
      actorId: 'sales-1',
      metadata: {
        siteVisitId: 'visit-1',
        leadId: 'lead-1',
        customerId: null,
        projectId: 'project-1',
        bookingId: 'booking-1',
        assignedToId: 'sales-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        scheduledAt: '2026-05-18T10:00:00.000Z',
        status: SiteVisitStatus.COMPLETED,
        outcomeNotes: 'Customer liked the corner plot',
      },
    });
  });

  it('logs site_visit.cancelled with cancellation reason after cancelling a site visit', async () => {
    prisma.siteVisit.findUnique
      .mockResolvedValueOnce({
        id: 'visit-1',
        status: SiteVisitStatus.SCHEDULED,
        assignedToId: 'sales-1',
        createdById: null,
      })
      .mockResolvedValueOnce(
        createSiteVisit(SiteVisitStatus.CANCELLED, {
          cancellationReason: 'Customer unavailable',
        }),
      );
    prisma.siteVisit.updateMany.mockResolvedValue({ count: 1 });

    await service.cancel(
      'visit-1',
      {
        cancellationReason: 'Customer unavailable',
      },
      createUser('sales-1', UserRole.SALES_EXECUTIVE),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'site_visit.cancelled',
      targetType: 'SiteVisit',
      targetId: 'visit-1',
      actorId: 'sales-1',
      metadata: {
        siteVisitId: 'visit-1',
        leadId: 'lead-1',
        customerId: null,
        projectId: 'project-1',
        bookingId: 'booking-1',
        assignedToId: 'sales-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        scheduledAt: '2026-05-18T10:00:00.000Z',
        status: SiteVisitStatus.CANCELLED,
        cancellationReason: 'Customer unavailable',
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

  function createSiteVisit(
    status: SiteVisitStatus,
    overrides: Partial<{
      cancellationReason: string | null;
      outcomeNotes: string | null;
    }> = {},
  ) {
    return {
      id: 'visit-1',
      scheduledAt: new Date('2026-05-18T10:00:00.000Z'),
      status,
      leadId: 'lead-1',
      customerId: null,
      projectId: 'project-1',
      bookingId: 'booking-1',
      assignedToId: 'sales-1',
      vehicleId: 'vehicle-1',
      driverId: 'driver-1',
      cancellationReason: null,
      outcomeNotes: null,
      ...overrides,
    };
  }
});
