import {
  BookingStatus,
  BookingType,
  LeadSource,
  LeadStatus,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let prisma: {
    lead: {
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    booking: {
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
      aggregate: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
  };
  let service: ReportsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-18T10:00:00.000Z'));
    prisma = {
      lead: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      booking: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };
    service = new ReportsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns lead report rows and applies inclusive date filters', async () => {
    prisma.lead.findMany.mockResolvedValue([
      {
        id: 'lead-1',
        fullName: 'Buyer One',
        phone: '9876543210',
        email: 'buyer@example.com',
        status: LeadStatus.NEW,
        source: LeadSource.WEBSITE,
        propertyType: 'Plot',
        budget: '25L',
        location: 'North',
        bookingAmount: '50000.00',
        bookingDate: new Date('2026-05-17T05:00:00.000Z'),
        followUpDate: null,
        createdAt: new Date('2026-05-16T05:00:00.000Z'),
        updatedAt: new Date('2026-05-17T06:00:00.000Z'),
        assignedTo: {
          id: 'sales-1',
          name: 'Sales One',
          email: 'sales@example.com',
        },
        createdBy: {
          id: 'admin-1',
          name: 'Admin One',
          email: 'admin@example.com',
        },
        finalProject: {
          id: 'project-1',
          projectName: 'Green Acres',
          location: 'North',
        },
        finalPlot: {
          id: 'plot-1',
          plotNumber: 'A1',
        },
      },
    ]);
    prisma.lead.count.mockResolvedValue(1);
    prisma.lead.groupBy
      .mockResolvedValueOnce([
        { status: LeadStatus.NEW, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { source: LeadSource.WEBSITE, _count: { _all: 1 } },
      ]);

    await expect(
      service.getLeadsReport({ from: '2026-05-01', to: '2026-05-18' }),
    ).resolves.toMatchObject({
      generatedAt: '2026-05-18T10:00:00.000Z',
      filters: {
        from: '2026-05-01T00:00:00.000Z',
        to: '2026-05-18T23:59:59.999Z',
      },
      totals: {
        total: 1,
        byStatus: {
          [LeadStatus.NEW]: 1,
          [LeadStatus.CANCELLED]: 0,
        },
        bySource: {
          [LeadSource.WEBSITE]: 1,
          UNSPECIFIED: 0,
        },
      },
      items: [
        {
          id: 'lead-1',
          fullName: 'Buyer One',
          bookingAmount: '50000.00',
          bookingDate: '2026-05-17T05:00:00.000Z',
        },
      ],
    });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-05-01T00:00:00.000Z'),
            lte: new Date('2026-05-18T23:59:59.999Z'),
          },
        },
      }),
    );
  });

  it('exports bookings as escaped CSV', async () => {
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'booking-1',
        type: BookingType.BOOKED,
        status: BookingStatus.ACTIVE,
        amountPaid: '100000.00',
        bookingDate: new Date('2026-05-10T08:00:00.000Z'),
        closedAt: null,
        cancelledAt: null,
        lead: {
          fullName: 'Buyer, "One"',
        },
        customer: null,
        project: {
          projectName: 'Green Acres',
        },
        plot: {
          plotNumber: 'A1',
        },
        salesExecutive: {
          id: 'sales-1',
          name: 'Sales One',
          email: 'sales@example.com',
        },
      },
    ]);
    prisma.booking.count.mockResolvedValue(1);
    prisma.booking.groupBy
      .mockResolvedValueOnce([
        { status: BookingStatus.ACTIVE, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { type: BookingType.BOOKED, _count: { _all: 1 } },
      ]);
    prisma.booking.aggregate.mockResolvedValue({
      _sum: {
        amountPaid: '100000.00',
      },
    });

    await expect(service.exportBookingsReport({})).resolves.toMatchObject({
      filename: 'bookings-report-2026-05-18.csv',
      content: expect.stringContaining('"Buyer, ""One"""'),
    });
  });

  it('rolls up sales performance by sales executive', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'sales-1',
        name: 'Sales One',
        email: 'sales@example.com',
        seId: 'SE-001',
      },
      {
        id: 'sales-2',
        name: 'Sales Two',
        email: 'sales2@example.com',
        seId: null,
      },
    ]);
    prisma.lead.groupBy
      .mockResolvedValueOnce([
        { createdById: 'sales-1', _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { assignedToId: 'sales-1', _count: { _all: 5 } },
      ]);
    prisma.booking.groupBy
      .mockResolvedValueOnce([
        {
          salesExecutiveId: 'sales-1',
          _count: { _all: 2 },
          _sum: { amountPaid: '250000.00' },
        },
      ])
      .mockResolvedValueOnce([
        {
          salesExecutiveId: 'sales-1',
          status: BookingStatus.CLOSED,
          _count: { _all: 1 },
        },
        {
          salesExecutiveId: 'sales-1',
          status: BookingStatus.ACTIVE,
          _count: { _all: 1 },
        },
      ])
      .mockResolvedValueOnce([
        {
          salesExecutiveId: 'sales-1',
          type: BookingType.BOOKED,
          _count: { _all: 2 },
        },
      ]);

    await expect(
      service.getSalesPerformanceReport({
        from: '2026-05-01',
        to: '2026-05-18',
      }),
    ).resolves.toMatchObject({
      totals: {
        salesExecutives: 2,
        leadsCreated: 3,
        leadsAssigned: 5,
        bookingsTotal: 2,
        closedBookings: 1,
        amountPaidTotal: 250000,
      },
      items: [
        {
          salesExecutiveId: 'sales-1',
          leadsCreated: 3,
          leadsAssigned: 5,
          bookingsTotal: 2,
          bookedBookings: 2,
          blockedBookings: 0,
          activeBookings: 1,
          closedBookings: 1,
          amountPaidTotal: 250000,
        },
        {
          salesExecutiveId: 'sales-2',
          leadsCreated: 0,
          leadsAssigned: 0,
          bookingsTotal: 0,
          amountPaidTotal: 0,
        },
      ],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: UserRole.SALES_EXECUTIVE,
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        seId: true,
      },
    });
  });
});
