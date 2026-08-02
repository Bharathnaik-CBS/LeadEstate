import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BookingStatus,
  BookingType,
  LeadSource,
  LeadStatus,
  Prisma,
  UserRole,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportDateRangeDto } from './dto/report-date-range.dto';

type ReportDateRange = {
  from?: Date;
  to?: Date;
};

type ReportFilters = {
  from: string | null;
  to: string | null;
};

type CsvExport = {
  filename: string;
  content: string;
};

type CountRow<TStatus extends string> = {
  status: TStatus;
  _count: {
    _all: number;
  };
};

type NullableSourceCountRow = {
  source: LeadSource | null;
  _count: {
    _all: number;
  };
};

type TypeCountRow<TType extends string> = {
  type: TType;
  _count: {
    _all: number;
  };
};

type LeadReportItem = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  status: LeadStatus;
  source: LeadSource | null;
  propertyType: string | null;
  budget: string | null;
  location: string | null;
  assignedTo: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string; email: string } | null;
  finalProject: { id: string; projectName: string; location: string } | null;
  finalPlot: { id: string; plotNumber: string } | null;
  bookingAmount: string | null;
  bookingDate: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type BookingReportItem = {
  id: string;
  type: BookingType;
  status: BookingStatus;
  contactName: string;
  leadName: string | null;
  customerName: string | null;
  projectName: string;
  plotNumber: string;
  salesExecutive: { id: string; name: string; email: string };
  amountPaid: string | null;
  bookingDate: string;
  closedAt: string | null;
  cancelledAt: string | null;
};

type SalesPerformanceItem = {
  salesExecutiveId: string;
  name: string;
  email: string;
  seId: string | null;
  leadsCreated: number;
  leadsAssigned: number;
  bookingsTotal: number;
  bookedBookings: number;
  blockedBookings: number;
  activeBookings: number;
  closedBookings: number;
  cancelledBookings: number;
  amountPaidTotal: number;
};

const SOURCE_UNSPECIFIED = 'UNSPECIFIED';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeadsReport(query: ReportDateRangeDto) {
    const generatedAt = new Date();
    const range = this.toDateRange(query);
    const dateFilter = this.toDateFilter(range);
    const where: Prisma.LeadWhereInput = {
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    const [leads, total, statusRows, sourceRows] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          fullName: true,
          phone: true,
          email: true,
          status: true,
          source: true,
          propertyType: true,
          budget: true,
          location: true,
          bookingAmount: true,
          bookingDate: true,
          followUpDate: true,
          createdAt: true,
          updatedAt: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          finalProject: {
            select: {
              id: true,
              projectName: true,
              location: true,
            },
          },
          finalPlot: {
            select: {
              id: true,
              plotNumber: true,
            },
          },
        },
      }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: {
          _all: true,
        },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    return {
      generatedAt: generatedAt.toISOString(),
      filters: this.toFilterPayload(range),
      totals: {
        total,
        byStatus: this.toCountRecord(Object.values(LeadStatus), statusRows),
        bySource: this.toLeadSourceCountRecord(sourceRows),
      },
      items: leads.map((lead) => this.toLeadReportItem(lead)),
    };
  }

  async exportLeadsReport(query: ReportDateRangeDto): Promise<CsvExport> {
    const report = await this.getLeadsReport(query);

    return {
      filename: this.toFilename('leads-report'),
      content: this.toCsv(
        [
          'Lead ID',
          'Lead Name',
          'Phone',
          'Email',
          'Status',
          'Source',
          'Requirement',
          'Location',
          'Budget',
          'Assigned To',
          'Created By',
          'Final Project',
          'Final Plot',
          'Booking Amount',
          'Booking Date',
          'Follow Up Date',
          'Created At',
          'Updated At',
        ],
        report.items.map((lead) => [
          lead.id,
          lead.fullName,
          lead.phone,
          lead.email,
          lead.status,
          lead.source,
          lead.propertyType,
          lead.location,
          lead.budget,
          lead.assignedTo?.name,
          lead.createdBy?.name,
          lead.finalProject?.projectName,
          lead.finalPlot?.plotNumber,
          lead.bookingAmount,
          lead.bookingDate,
          lead.followUpDate,
          lead.createdAt,
          lead.updatedAt,
        ]),
      ),
    };
  }

  async getBookingsReport(query: ReportDateRangeDto) {
    const generatedAt = new Date();
    const range = this.toDateRange(query);
    const dateFilter = this.toDateFilter(range);
    const where: Prisma.BookingWhereInput = {
      ...(dateFilter ? { bookingDate: dateFilter } : {}),
    };

    const [bookings, total, statusRows, typeRows, amountAggregate] =
      await Promise.all([
        this.prisma.booking.findMany({
          where,
          orderBy: {
            bookingDate: 'desc',
          },
          select: {
            id: true,
            type: true,
            status: true,
            amountPaid: true,
            bookingDate: true,
            closedAt: true,
            cancelledAt: true,
            lead: {
              select: {
                fullName: true,
              },
            },
            customer: {
              select: {
                fullName: true,
              },
            },
            project: {
              select: {
                projectName: true,
              },
            },
            plot: {
              select: {
                plotNumber: true,
              },
            },
            salesExecutive: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.booking.count({ where }),
        this.prisma.booking.groupBy({
          by: ['status'],
          where,
          _count: {
            _all: true,
          },
        }),
        this.prisma.booking.groupBy({
          by: ['type'],
          where,
          _count: {
            _all: true,
          },
        }),
        this.prisma.booking.aggregate({
          where,
          _sum: {
            amountPaid: true,
          },
        }),
      ]);

    return {
      generatedAt: generatedAt.toISOString(),
      filters: this.toFilterPayload(range),
      totals: {
        total,
        amountPaidTotal: this.toNumber(amountAggregate._sum.amountPaid),
        byStatus: this.toCountRecord(Object.values(BookingStatus), statusRows),
        byType: this.toTypeCountRecord(Object.values(BookingType), typeRows),
      },
      items: bookings.map((booking) => this.toBookingReportItem(booking)),
    };
  }

  async exportBookingsReport(query: ReportDateRangeDto): Promise<CsvExport> {
    const report = await this.getBookingsReport(query);

    return {
      filename: this.toFilename('bookings-report'),
      content: this.toCsv(
        [
          'Booking ID',
          'Contact Name',
          'Lead Name',
          'Customer Name',
          'Project',
          'Plot',
          'Type',
          'Status',
          'Sales Executive',
          'Amount Paid',
          'Booking Date',
          'Closed At',
          'Cancelled At',
        ],
        report.items.map((booking) => [
          booking.id,
          booking.contactName,
          booking.leadName,
          booking.customerName,
          booking.projectName,
          booking.plotNumber,
          booking.type,
          booking.status,
          booking.salesExecutive.name,
          booking.amountPaid,
          booking.bookingDate,
          booking.closedAt,
          booking.cancelledAt,
        ]),
      ),
    };
  }

  async getSalesPerformanceReport(query: ReportDateRangeDto) {
    const generatedAt = new Date();
    const range = this.toDateRange(query);
    const dateFilter = this.toDateFilter(range);
    const leadCreatedWhere: Prisma.LeadWhereInput = {
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      createdById: {
        not: null,
      },
    };
    const leadAssignedWhere: Prisma.LeadWhereInput = {
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      assignedToId: {
        not: null,
      },
    };
    const bookingWhere: Prisma.BookingWhereInput = {
      ...(dateFilter ? { bookingDate: dateFilter } : {}),
    };

    const [
      salesExecutives,
      createdLeadRows,
      assignedLeadRows,
      bookingRows,
      bookingStatusRows,
      bookingTypeRows,
    ] = await Promise.all([
      this.prisma.user.findMany({
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
      }),
      this.prisma.lead.groupBy({
        by: ['createdById'],
        where: leadCreatedWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.lead.groupBy({
        by: ['assignedToId'],
        where: leadAssignedWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.booking.groupBy({
        by: ['salesExecutiveId'],
        where: bookingWhere,
        _count: {
          _all: true,
        },
        _sum: {
          amountPaid: true,
        },
      }),
      this.prisma.booking.groupBy({
        by: ['salesExecutiveId', 'status'],
        where: bookingWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.booking.groupBy({
        by: ['salesExecutiveId', 'type'],
        where: bookingWhere,
        _count: {
          _all: true,
        },
      }),
    ]);

    const createdLeadCounts = this.toNullableIdCountMap(
      createdLeadRows,
      'createdById',
    );
    const assignedLeadCounts = this.toNullableIdCountMap(
      assignedLeadRows,
      'assignedToId',
    );
    const bookingCounts = new Map(
      bookingRows.map((row) => [
        row.salesExecutiveId,
        {
          total: row._count._all,
          amountPaidTotal: this.toNumber(row._sum.amountPaid),
        },
      ]),
    );
    const bookingStatusCounts = this.toNestedCountMap(
      bookingStatusRows,
      'salesExecutiveId',
      'status',
    );
    const bookingTypeCounts = this.toNestedCountMap(
      bookingTypeRows,
      'salesExecutiveId',
      'type',
    );

    const items: SalesPerformanceItem[] = salesExecutives.map((salesUser) => {
      const bookingSummary = bookingCounts.get(salesUser.id);
      const statusCounts = bookingStatusCounts.get(salesUser.id);
      const typeCounts = bookingTypeCounts.get(salesUser.id);

      return {
        salesExecutiveId: salesUser.id,
        name: salesUser.name,
        email: salesUser.email,
        seId: salesUser.seId,
        leadsCreated: createdLeadCounts.get(salesUser.id) ?? 0,
        leadsAssigned: assignedLeadCounts.get(salesUser.id) ?? 0,
        bookingsTotal: bookingSummary?.total ?? 0,
        bookedBookings: typeCounts?.get(BookingType.BOOKED) ?? 0,
        blockedBookings: typeCounts?.get(BookingType.BLOCKED) ?? 0,
        activeBookings: statusCounts?.get(BookingStatus.ACTIVE) ?? 0,
        closedBookings: statusCounts?.get(BookingStatus.CLOSED) ?? 0,
        cancelledBookings: statusCounts?.get(BookingStatus.CANCELLED) ?? 0,
        amountPaidTotal: bookingSummary?.amountPaidTotal ?? 0,
      };
    });

    return {
      generatedAt: generatedAt.toISOString(),
      filters: this.toFilterPayload(range),
      totals: {
        salesExecutives: items.length,
        leadsCreated: this.sumItems(items, 'leadsCreated'),
        leadsAssigned: this.sumItems(items, 'leadsAssigned'),
        bookingsTotal: this.sumItems(items, 'bookingsTotal'),
        closedBookings: this.sumItems(items, 'closedBookings'),
        amountPaidTotal: this.sumItems(items, 'amountPaidTotal'),
      },
      items,
    };
  }

  async exportSalesPerformanceReport(
    query: ReportDateRangeDto,
  ): Promise<CsvExport> {
    const report = await this.getSalesPerformanceReport(query);

    return {
      filename: this.toFilename('sales-performance-report'),
      content: this.toCsv(
        [
          'Sales Executive ID',
          'Sales Executive',
          'Email',
          'SE ID',
          'Leads Created',
          'Leads Assigned',
          'Total Bookings',
          'Booked Bookings',
          'Blocked Bookings',
          'Active Bookings',
          'Closed Bookings',
          'Cancelled Bookings',
          'Amount Paid Total',
        ],
        report.items.map((item) => [
          item.salesExecutiveId,
          item.name,
          item.email,
          item.seId,
          item.leadsCreated,
          item.leadsAssigned,
          item.bookingsTotal,
          item.bookedBookings,
          item.blockedBookings,
          item.activeBookings,
          item.closedBookings,
          item.cancelledBookings,
          item.amountPaidTotal,
        ]),
      ),
    };
  }

  private toLeadReportItem(lead: {
    id: string;
    fullName: string;
    phone: string;
    email: string | null;
    status: LeadStatus;
    source: LeadSource | null;
    propertyType: string | null;
    budget: string | null;
    location: string | null;
    assignedTo: { id: string; name: string; email: string } | null;
    createdBy: { id: string; name: string; email: string } | null;
    finalProject: { id: string; projectName: string; location: string } | null;
    finalPlot: { id: string; plotNumber: string } | null;
    bookingAmount: unknown;
    bookingDate: Date | null;
    followUpDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): LeadReportItem {
    return {
      id: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      status: lead.status,
      source: lead.source,
      propertyType: lead.propertyType,
      budget: lead.budget,
      location: lead.location,
      assignedTo: lead.assignedTo,
      createdBy: lead.createdBy,
      finalProject: lead.finalProject,
      finalPlot: lead.finalPlot,
      bookingAmount: this.toDecimalString(lead.bookingAmount),
      bookingDate: this.toIsoString(lead.bookingDate),
      followUpDate: this.toIsoString(lead.followUpDate),
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
    };
  }

  private toBookingReportItem(booking: {
    id: string;
    type: BookingType;
    status: BookingStatus;
    amountPaid: unknown;
    bookingDate: Date;
    closedAt: Date | null;
    cancelledAt: Date | null;
    lead: { fullName: string } | null;
    customer: { fullName: string } | null;
    project: { projectName: string };
    plot: { plotNumber: string };
    salesExecutive: { id: string; name: string; email: string };
  }): BookingReportItem {
    return {
      id: booking.id,
      type: booking.type,
      status: booking.status,
      contactName:
        booking.customer?.fullName ?? booking.lead?.fullName ?? 'Unassigned',
      leadName: booking.lead?.fullName ?? null,
      customerName: booking.customer?.fullName ?? null,
      projectName: booking.project.projectName,
      plotNumber: booking.plot.plotNumber,
      salesExecutive: booking.salesExecutive,
      amountPaid: this.toDecimalString(booking.amountPaid),
      bookingDate: booking.bookingDate.toISOString(),
      closedAt: this.toIsoString(booking.closedAt),
      cancelledAt: this.toIsoString(booking.cancelledAt),
    };
  }

  private toDateRange(query: ReportDateRangeDto): ReportDateRange {
    const from = query.from ? this.parseDate(query.from, 'start') : undefined;
    const to = query.to ? this.parseDate(query.to, 'end') : undefined;

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('From date must be before to date');
    }

    return { from, to };
  }

  private parseDate(value: string, boundary: 'start' | 'end') {
    const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
    const normalizedValue = dateOnlyPattern.test(value)
      ? `${value}T${boundary === 'start' ? '00:00:00.000' : '23:59:59.999'}Z`
      : value;
    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Date filters must be valid dates');
    }

    return date;
  }

  private toDateFilter(range: ReportDateRange): Prisma.DateTimeFilter | undefined {
    if (!range.from && !range.to) {
      return undefined;
    }

    return {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }

  private toFilterPayload(range: ReportDateRange): ReportFilters {
    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    };
  }

  private toCountRecord<TStatus extends string>(
    statuses: TStatus[],
    rows: Array<CountRow<TStatus>>,
  ): Record<TStatus, number> {
    const counts = Object.fromEntries(
      statuses.map((status) => [status, 0]),
    ) as Record<TStatus, number>;

    for (const row of rows) {
      counts[row.status] = row._count._all;
    }

    return counts;
  }

  private toTypeCountRecord<TType extends string>(
    types: TType[],
    rows: Array<TypeCountRow<TType>>,
  ): Record<TType, number> {
    const counts = Object.fromEntries(
      types.map((type) => [type, 0]),
    ) as Record<TType, number>;

    for (const row of rows) {
      counts[row.type] = row._count._all;
    }

    return counts;
  }

  private toLeadSourceCountRecord(rows: NullableSourceCountRow[]) {
    const counts = Object.fromEntries(
      Object.values(LeadSource).map((source) => [source, 0]),
    ) as Record<LeadSource | typeof SOURCE_UNSPECIFIED, number>;
    counts[SOURCE_UNSPECIFIED] = 0;

    for (const row of rows) {
      counts[row.source ?? SOURCE_UNSPECIFIED] = row._count._all;
    }

    return counts;
  }

  private toNullableIdCountMap<TIdKey extends string>(
    rows: Array<Record<TIdKey, string | null> & { _count: { _all: number } }>,
    idKey: TIdKey,
  ) {
    const counts = new Map<string, number>();

    for (const row of rows) {
      const id = row[idKey];

      if (id) {
        counts.set(id, row._count._all);
      }
    }

    return counts;
  }

  private toNestedCountMap<
    TIdKey extends string,
    TGroupKey extends string,
    TGroupValue extends string,
  >(
    rows: Array<
      Record<TIdKey, string> &
        Record<TGroupKey, TGroupValue> & { _count: { _all: number } }
    >,
    idKey: TIdKey,
    groupKey: TGroupKey,
  ) {
    const counts = new Map<string, Map<TGroupValue, number>>();

    for (const row of rows) {
      const id = row[idKey];
      const group = row[groupKey];
      const existingCounts = counts.get(id) ?? new Map<TGroupValue, number>();
      existingCounts.set(group, row._count._all);
      counts.set(id, existingCounts);
    }

    return counts;
  }

  private sumItems<TItem, TKey extends keyof TItem>(
    items: TItem[],
    key: TKey,
  ) {
    return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
  }

  private toDecimalString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    return value.toString();
  }

  private toNumber(value: unknown) {
    if (value === null || value === undefined) {
      return 0;
    }

    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? 0 : numericValue;
  }

  private toIsoString(value: Date | null) {
    return value ? value.toISOString() : null;
  }

  private toCsv(headers: string[], rows: unknown[][]) {
    return [
      headers.map((header) => this.toCsvCell(header)).join(','),
      ...rows.map((row) => row.map((cell) => this.toCsvCell(cell)).join(',')),
    ].join('\r\n');
  }

  private toCsvCell(value: unknown) {
    const text = value === null || value === undefined ? '' : String(value);
    const escapedText = text.replace(/"/g, '""');

    return /[",\r\n]/.test(escapedText) ? `"${escapedText}"` : escapedText;
  }

  private toFilename(prefix: string) {
    return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  }
}
