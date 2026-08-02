import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { LeadSource, LeadStatus, UserRole } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  let prisma: {
    lead: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let activityEventsService: {
    log: jest.Mock;
  };
  let service: LeadsService;

  beforeEach(() => {
    prisma = {
      lead: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    activityEventsService = {
      log: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    service = new LeadsService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('persists platformId when creating a lead', async () => {
    const lead = createLead();
    prisma.lead.create.mockResolvedValue(lead);

    await expect(
      service.create(
        {
          fullName: 'Buyer One',
          phone: '9876543210',
          platformId: lead.platformId,
        },
        adminUser,
      ),
    ).resolves.toEqual(lead);

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          platform: {
            connect: {
              id: lead.platformId,
            },
          },
        }),
      }),
    );
  });

  it('logs lead.created after creating a lead', async () => {
    const lead = createLead();
    prisma.lead.create.mockResolvedValue(lead);

    await service.create(
      {
        fullName: 'Buyer One',
        phone: '9876543210',
      },
      adminUser,
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'lead.created',
      targetType: 'Lead',
      targetId: 'lead-1',
      actorId: 'admin-1',
      metadata: {
        leadId: 'lead-1',
        assignedToId: null,
        status: LeadStatus.NEW,
      },
    });
  });

  it('logs lead.updated with status changes after updating a lead', async () => {
    prisma.lead.findUnique.mockResolvedValue(
      createLead({
        assignedToId: 'sales-1',
        status: LeadStatus.NEW,
      }),
    );
    prisma.lead.update.mockResolvedValue(
      createLead({
        assignedToId: 'sales-1',
        status: LeadStatus.FOLLOW_UP,
      }),
    );

    await service.update(
      'lead-1',
      {
        status: LeadStatus.FOLLOW_UP,
      },
      adminUser,
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'lead.updated',
      targetType: 'Lead',
      targetId: 'lead-1',
      actorId: 'admin-1',
      metadata: {
        leadId: 'lead-1',
        assignedToId: 'sales-1',
        status: LeadStatus.FOLLOW_UP,
        previousStatus: LeadStatus.NEW,
      },
    });
  });

  it('logs lead.deleted after deleting a lead', async () => {
    prisma.lead.findUnique.mockResolvedValue(
      createLead({
        assignedToId: 'sales-1',
      }),
    );
    prisma.lead.delete.mockResolvedValue(createLead());

    await service.remove('lead-1', adminUser);

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'lead.deleted',
      targetType: 'Lead',
      targetId: 'lead-1',
      actorId: 'admin-1',
      metadata: {
        leadId: 'lead-1',
        assignedToId: 'sales-1',
        status: LeadStatus.NEW,
      },
    });
  });

  it('logs lead.assigned after assigning a lead', async () => {
    prisma.lead.findUnique.mockResolvedValue(createLead());
    prisma.user.findUnique.mockResolvedValue({
      id: 'sales-1',
      role: UserRole.SALES_EXECUTIVE,
    });
    prisma.lead.update.mockResolvedValue(
      createLead({
        assignedToId: 'sales-1',
      }),
    );

    await service.assign(
      'lead-1',
      {
        assignedToId: 'sales-1',
      },
      adminUser,
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'lead.assigned',
      targetType: 'Lead',
      targetId: 'lead-1',
      actorId: 'admin-1',
      metadata: {
        leadId: 'lead-1',
        assignedToId: 'sales-1',
        status: LeadStatus.NEW,
        previousAssignedToId: null,
      },
    });
  });

  it('includes platform details when listing leads', async () => {
    const leads = [createLead()];
    prisma.lead.findMany.mockResolvedValue(leads);

    await expect(service.findAll()).resolves.toEqual(leads);

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          platform: {
            select: {
              id: true,
              name: true,
            },
          },
        }),
      }),
    );
  });

  it('includes platform details when fetching a lead', async () => {
    const lead = createLead();
    prisma.lead.findUnique.mockResolvedValue(lead);

    await expect(service.findOne(lead.id, adminUser)).resolves.toEqual(lead);

    expect(prisma.lead.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: lead.id,
        },
        include: expect.objectContaining({
          platform: {
            select: {
              id: true,
              name: true,
            },
          },
        }),
      }),
    );
  });

  const adminUser = {
    userId: 'admin-1',
    role: UserRole.ADMIN,
  } as AuthenticatedUser;

  function createLead(overrides = {}) {
    return {
      id: 'lead-1',
      fullName: 'Buyer One',
      phone: '9876543210',
      email: null,
      propertyType: null,
      budget: null,
      location: null,
      source: LeadSource.ADMIN_GENERATED,
      status: LeadStatus.NEW,
      notes: null,
      remarks: null,
      followUpDate: null,
      interestedProjectIds: [],
      finalProjectId: null,
      finalPlotId: null,
      platformId: '11111111-1111-4111-8111-111111111111',
      platform: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Website',
      },
      bookingAmount: null,
      bookingDate: null,
      createdById: 'admin-1',
      assignedToId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
