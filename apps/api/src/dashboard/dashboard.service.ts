import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  BookingKycStatus,
  BookingStatus,
  FollowUpStatus,
  LeadSource,
  LeadStatus,
  PaymentStatus,
  PlotBlockStatus,
  PlotStatus,
  Prisma,
  SiteVisitStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminDashboardQueryDto } from './dto/admin-dashboard-query.dto';

const DEFAULT_PENDING_ACTION_TAKE = 20;
const MAX_PENDING_ACTION_TAKE = 50;
const DEFAULT_RECENT_ACTIVITY_TAKE = 20;
const MAX_RECENT_ACTIVITY_TAKE = 50;
const DEFAULT_ADMIN_ANALYTICS_DAYS = 14;
const MAX_ADMIN_ANALYTICS_DAYS = 60;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type PendingActionPriority = 'HIGH' | 'MEDIUM' | 'LOW';

type PendingActionItem = {
  id: string;
  type: string;
  priority: PendingActionPriority;
  title: string;
  dueAt?: string;
  entity: {
    type: string;
    id: string;
    label: string;
  };
};

type RecentActivityItem = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  occurredAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  metadata?: unknown;
};

type NormalizedAdminDashboardFilters = {
  startDate: Date;
  endDate: Date;
  selectedDate: Date;
  projectId?: string;
  source?: LeadSource;
  platformId?: string;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return { ok: true };
  }

  async getAdminSummary(query: AdminDashboardQueryDto = {}) {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + SEVEN_DAYS_MS);
    const analyticsFilters = this.toAdminDashboardFilters(query, now);
    const leadAnalyticsWhere = this.toLeadAnalyticsWhere(analyticsFilters);
    const selectedDayStart = this.startOfDay(analyticsFilters.selectedDate);
    const selectedDayEnd = this.endOfDay(analyticsFilters.selectedDate);
    const [
      leads,
      customers,
      bookings,
      projects,
      leadsByStatus,
      bookingsByStatus,
      plotsByStatus,
      followUpsDue,
      kycPending,
      paymentPending,
      siteVisitsUpcoming,
      plotBlocksExpiring,
      projectOptions,
      platformOptions,
      totalLeads,
      leadsBeforeRange,
      leadCreatedAtRows,
      leadsOnSelectedDay,
      leadsByProject,
      leadsBySource,
      leadsByPlatform,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.customer.count(),
      this.prisma.booking.count(),
      this.prisma.project.count(),
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.plot.groupBy({
        by: ['status'],
        _count: {
          _all: true,
        },
      }),
      this.prisma.followUp.count({
        where: {
          status: FollowUpStatus.PENDING,
          dueAt: {
            lte: now,
          },
        },
      }),
      this.prisma.bookingKyc.count({
        where: {
          status: BookingKycStatus.PENDING,
        },
      }),
      this.prisma.bookingPayment.count({
        where: {
          status: PaymentStatus.PENDING,
        },
      }),
      this.prisma.siteVisit.count({
        where: {
          status: SiteVisitStatus.SCHEDULED,
          scheduledAt: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
      }),
      this.prisma.plotBlock.count({
        where: {
          status: PlotBlockStatus.ACTIVE,
          expiresAt: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
      }),
      this.prisma.project.findMany({
        orderBy: {
          projectName: 'asc',
        },
        select: {
          id: true,
          projectName: true,
          location: true,
        },
      }),
      this.prisma.platform.findMany({
        orderBy: {
          name: 'asc',
        },
        select: {
          id: true,
          name: true,
        },
      }),
      this.prisma.lead.count({
        where: leadAnalyticsWhere,
      }),
      this.prisma.lead.count({
        where: this.toLeadAnalyticsWhere(analyticsFilters, {
          endDate: new Date(analyticsFilters.startDate.getTime() - 1),
        }),
      }),
      this.prisma.lead.findMany({
        where: leadAnalyticsWhere,
        select: {
          createdAt: true,
        },
      }),
      this.prisma.lead.count({
        where: this.toLeadAnalyticsWhere(analyticsFilters, {
          startDate: selectedDayStart,
          endDate: selectedDayEnd,
        }),
      }),
      this.prisma.lead.groupBy({
        by: ['finalProjectId'],
        where: leadAnalyticsWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.lead.groupBy({
        by: ['source'],
        where: leadAnalyticsWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.lead.groupBy({
        by: ['platformId'],
        where: leadAnalyticsWhere,
        _count: {
          _all: true,
        },
      }),
    ]);
    const leadsByDay = this.toDailyLeadCounts(
      leadCreatedAtRows,
      analyticsFilters.startDate,
      analyticsFilters.endDate,
    );

    return {
      generatedAt: now.toISOString(),
      totals: {
        leads,
        customers,
        bookings,
        projects,
      },
      breakdowns: {
        leadsByStatus: this.toCountRecord(Object.values(LeadStatus), leadsByStatus),
        bookingsByStatus: this.toCountRecord(
          Object.values(BookingStatus),
          bookingsByStatus,
        ),
        plotsByStatus: this.toCountRecord(Object.values(PlotStatus), plotsByStatus),
      },
      pendingActions: {
        followUpsDue,
        kycPending,
        paymentPending,
        siteVisitsUpcoming,
        plotBlocksExpiring,
      },
      filters: {
        startDate: this.toDateKey(analyticsFilters.startDate),
        endDate: this.toDateKey(analyticsFilters.endDate),
        selectedDate: this.toDateKey(analyticsFilters.selectedDate),
        projectId: analyticsFilters.projectId ?? null,
        source: analyticsFilters.source ?? null,
        platformId: analyticsFilters.platformId ?? null,
        availableProjects: projectOptions,
        availablePlatforms: platformOptions,
        availableSources: Object.values(LeadSource),
      },
      analytics: {
        totalLeads,
        totalLeadsTrend: this.toTotalLeadTrend(leadsByDay, leadsBeforeRange),
        leadsByProject: this.toProjectLeadBreakdown(
          leadsByProject,
          projectOptions,
        ),
        leadsBySource: this.toSourceLeadBreakdown(leadsBySource),
        leadsByPlatform: this.toPlatformLeadBreakdown(
          leadsByPlatform,
          platformOptions,
        ),
        leadsByDay,
        leadsOnSelectedDay: {
          date: this.toDateKey(analyticsFilters.selectedDate),
          label: this.toShortDateLabel(analyticsFilters.selectedDate),
          count: leadsOnSelectedDay,
        },
        dateRange: {
          startDate: this.toDateKey(analyticsFilters.startDate),
          endDate: this.toDateKey(analyticsFilters.endDate),
          days: leadsByDay.length,
        },
      },
    };
  }

  async getSalesSummary(user: AuthenticatedUser) {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + SEVEN_DAYS_MS);
    const userOwnershipWhere = this.toUserOwnershipWhere(user.userId);
    const [
      leads,
      customers,
      bookings,
      siteVisits,
      followUpsDue,
      siteVisitsUpcoming,
      kycPending,
      paymentPending,
      plotBlocksExpiring,
      leadsByStatus,
      bookingsByStatus,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: {
          assignedToId: user.userId,
        },
      }),
      this.prisma.customer.count({
        where: userOwnershipWhere,
      }),
      this.prisma.booking.count({
        where: {
          salesExecutiveId: user.userId,
        },
      }),
      this.prisma.siteVisit.count({
        where: userOwnershipWhere,
      }),
      this.prisma.followUp.count({
        where: {
          ...userOwnershipWhere,
          status: FollowUpStatus.PENDING,
          dueAt: {
            lte: now,
          },
        },
      }),
      this.prisma.siteVisit.count({
        where: {
          ...userOwnershipWhere,
          status: SiteVisitStatus.SCHEDULED,
          scheduledAt: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
      }),
      this.prisma.bookingKyc.count({
        where: {
          status: BookingKycStatus.PENDING,
          booking: {
            salesExecutiveId: user.userId,
          },
        },
      }),
      this.prisma.bookingPayment.count({
        where: {
          status: PaymentStatus.PENDING,
          booking: {
            salesExecutiveId: user.userId,
          },
        },
      }),
      this.prisma.plotBlock.count({
        where: {
          blockedById: user.userId,
          status: PlotBlockStatus.ACTIVE,
          expiresAt: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
      }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where: {
          assignedToId: user.userId,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where: {
          salesExecutiveId: user.userId,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    return {
      generatedAt: now.toISOString(),
      totals: {
        leads,
        customers,
        bookings,
        siteVisits,
      },
      pendingActions: {
        followUpsDue,
        siteVisitsUpcoming,
        kycPending,
        paymentPending,
        plotBlocksExpiring,
      },
      breakdowns: {
        leadsByStatus: this.toCountRecord(Object.values(LeadStatus), leadsByStatus),
        bookingsByStatus: this.toCountRecord(
          Object.values(BookingStatus),
          bookingsByStatus,
        ),
      },
    };
  }

  async getPendingActions(takeInput?: string) {
    const take = this.toPendingActionTake(takeInput);
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + SEVEN_DAYS_MS);

    const [followUps, kycs, payments, siteVisits, plotBlocks] =
      await Promise.all([
        this.prisma.followUp.findMany({
          where: {
            status: FollowUpStatus.PENDING,
            dueAt: {
              lte: now,
            },
          },
          orderBy: {
            dueAt: 'asc',
          },
          take,
          select: {
            id: true,
            dueAt: true,
            lead: {
              select: {
                id: true,
                fullName: true,
              },
            },
            customer: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        }),
        this.prisma.bookingKyc.findMany({
          where: {
            status: BookingKycStatus.PENDING,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take,
          select: {
            id: true,
            booking: {
              select: {
                id: true,
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
              },
            },
          },
        }),
        this.prisma.bookingPayment.findMany({
          where: {
            status: PaymentStatus.PENDING,
          },
          orderBy: {
            createdAt: 'asc',
          },
          take,
          select: {
            id: true,
            booking: {
              select: {
                id: true,
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
              },
            },
          },
        }),
        this.prisma.siteVisit.findMany({
          where: {
            status: SiteVisitStatus.SCHEDULED,
            scheduledAt: {
              gte: now,
              lte: sevenDaysFromNow,
            },
          },
          orderBy: {
            scheduledAt: 'asc',
          },
          take,
          select: {
            id: true,
            scheduledAt: true,
            lead: {
              select: {
                id: true,
                fullName: true,
              },
            },
            customer: {
              select: {
                id: true,
                fullName: true,
              },
            },
            project: {
              select: {
                id: true,
                projectName: true,
              },
            },
          },
        }),
        this.prisma.plotBlock.findMany({
          where: {
            status: PlotBlockStatus.ACTIVE,
            expiresAt: {
              gte: now,
              lte: sevenDaysFromNow,
            },
          },
          orderBy: {
            expiresAt: 'asc',
          },
          take,
          select: {
            id: true,
            expiresAt: true,
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
          },
        }),
      ]);

    const items = [
      ...followUps.map((followUp) => this.toFollowUpAction(followUp, now)),
      ...kycs.map((kyc) => this.toKycAction(kyc)),
      ...payments.map((payment) => this.toPaymentAction(payment)),
      ...siteVisits.map((siteVisit) => this.toSiteVisitAction(siteVisit, now)),
      ...plotBlocks.map((plotBlock) => this.toPlotBlockAction(plotBlock, now)),
    ]
      .sort((left, right) => this.comparePendingActions(left, right))
      .slice(0, take);

    return {
      generatedAt: now.toISOString(),
      items,
    };
  }

  async getRecentActivity(takeInput?: string, cursor?: string) {
    const take = this.toRecentActivityTake(takeInput);
    const activityEvents = await this.prisma.activityEvent.findMany({
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      skip: cursor ? 1 : undefined,
      cursor: cursor
        ? {
            id: cursor,
          }
        : undefined,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        occurredAt: true,
        metadata: true,
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const hasMore = activityEvents.length > take;
    const items = activityEvents
      .slice(0, take)
      .map((activityEvent) => this.toRecentActivityItem(activityEvent));

    return {
      items,
      nextCursor: hasMore ? items.at(-1)?.id ?? null : null,
    };
  }

  private toAdminDashboardFilters(
    query: AdminDashboardQueryDto,
    now: Date,
  ): NormalizedAdminDashboardFilters {
    const defaultEndDate = this.startOfDay(now);
    const defaultStartDate = this.addDays(
      defaultEndDate,
      -(DEFAULT_ADMIN_ANALYTICS_DAYS - 1),
    );
    let startDate = this.startOfDay(
      this.toDate(query.startDate) ?? defaultStartDate,
    );
    let endDate = this.endOfDay(this.toDate(query.endDate) ?? defaultEndDate);

    if (startDate.getTime() > endDate.getTime()) {
      [startDate, endDate] = [this.startOfDay(endDate), this.endOfDay(startDate)];
    }

    const maxStartDate = this.startOfDay(
      this.addDays(endDate, -(MAX_ADMIN_ANALYTICS_DAYS - 1)),
    );

    if (startDate.getTime() < maxStartDate.getTime()) {
      startDate = maxStartDate;
    }

    const selectedDate = this.startOfDay(
      this.toDate(query.selectedDate) ?? endDate,
    );

    return {
      startDate,
      endDate,
      selectedDate,
      projectId: query.projectId,
      source: query.source,
      platformId: query.platformId,
    };
  }

  private toLeadAnalyticsWhere(
    filters: NormalizedAdminDashboardFilters,
    range: { startDate?: Date; endDate?: Date } = {
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
  ): Prisma.LeadWhereInput {
    const and: Prisma.LeadWhereInput[] = [];

    if (range.startDate || range.endDate) {
      and.push({
        createdAt: {
          ...(range.startDate ? { gte: range.startDate } : {}),
          ...(range.endDate ? { lte: range.endDate } : {}),
        },
      });
    }

    if (filters.projectId) {
      and.push({
        OR: [
          { finalProjectId: filters.projectId },
          {
            interestedProjects: {
              some: {
                projectId: filters.projectId,
              },
            },
          },
        ],
      });
    }

    if (filters.source) {
      and.push({
        source: filters.source,
      });
    }

    if (filters.platformId) {
      and.push({
        platformId: filters.platformId,
      });
    }

    return and.length ? { AND: and } : {};
  }

  private toDailyLeadCounts(
    leads: Array<{ createdAt: Date }>,
    startDate: Date,
    endDate: Date,
  ) {
    const counts = new Map<string, number>();

    for (const lead of leads) {
      const key = this.toDateKey(lead.createdAt);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const days: Array<{ date: string; label: string; count: number }> = [];
    let cursor = this.startOfDay(startDate);
    const rangeEnd = this.startOfDay(endDate);

    while (cursor.getTime() <= rangeEnd.getTime()) {
      const key = this.toDateKey(cursor);
      days.push({
        date: key,
        label: this.toShortDateLabel(cursor),
        count: counts.get(key) ?? 0,
      });
      cursor = this.addDays(cursor, 1);
    }

    return days;
  }

  private toTotalLeadTrend(
    leadsByDay: Array<{ date: string; label: string; count: number }>,
    leadsBeforeRange: number,
  ) {
    let total = leadsBeforeRange;

    return leadsByDay.map((day) => {
      total += day.count;

      return {
        date: day.date,
        label: day.label,
        count: total,
      };
    });
  }

  private toProjectLeadBreakdown(
    rows: Array<{ finalProjectId: string | null; _count: { _all: number } }>,
    projects: Array<{ id: string; projectName: string }>,
  ) {
    const projectNames = new Map(
      projects.map((project) => [project.id, project.projectName]),
    );

    return rows
      .map((row) => ({
        projectId: row.finalProjectId,
        label: row.finalProjectId
          ? projectNames.get(row.finalProjectId) ?? 'Unknown project'
          : 'Unassigned',
        count: row._count._all,
      }))
      .sort((left, right) => right.count - left.count);
  }

  private toSourceLeadBreakdown(
    rows: Array<{ source: LeadSource | null; _count: { _all: number } }>,
  ) {
    return rows
      .map((row) => ({
        source: row.source,
        label: row.source ? this.toTitleLabel(row.source) : 'Not set',
        count: row._count._all,
      }))
      .sort((left, right) => right.count - left.count);
  }

  private toPlatformLeadBreakdown(
    rows: Array<{ platformId: string | null; _count: { _all: number } }>,
    platforms: Array<{ id: string; name: string }>,
  ) {
    const platformNames = new Map(
      platforms.map((platform) => [platform.id, platform.name]),
    );

    return rows
      .map((row) => ({
        platformId: row.platformId,
        label: row.platformId
          ? platformNames.get(row.platformId) ?? 'Unknown platform'
          : 'Not set',
        count: row._count._all,
      }))
      .sort((left, right) => right.count - left.count);
  }

  private toCountRecord<TStatus extends string>(
    statuses: TStatus[],
    rows: Array<{ status: TStatus; _count: { _all: number } }>,
  ): Record<string, number> {
    const counts = Object.fromEntries(
      statuses.map((status) => [status, 0]),
    ) as Record<string, number>;

    for (const row of rows) {
      counts[row.status] = row._count._all;
    }

    return counts;
  }

  private toDate(value?: string) {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: Date) {
    const date = new Date(value);
    date.setUTCHours(23, 59, 59, 999);
    return date;
  }

  private addDays(value: Date, days: number) {
    const date = new Date(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  }

  private toDateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private toShortDateLabel(value: Date) {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
    }).format(value);
  }

  private toTitleLabel(value: string) {
    return value
      .split('_')
      .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }

  private toUserOwnershipWhere(userId: string) {
    return {
      OR: [{ assignedToId: userId }, { createdById: userId }],
    };
  }

  private toPendingActionTake(takeInput?: string) {
    const take = Number(takeInput);

    if (!Number.isInteger(take) || take < 1) {
      return DEFAULT_PENDING_ACTION_TAKE;
    }

    return Math.min(take, MAX_PENDING_ACTION_TAKE);
  }

  private toRecentActivityTake(takeInput?: string) {
    const take = Number(takeInput);

    if (!Number.isInteger(take) || take < 1) {
      return DEFAULT_RECENT_ACTIVITY_TAKE;
    }

    return Math.min(take, MAX_RECENT_ACTIVITY_TAKE);
  }

  private toRecentActivityItem(activityEvent: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    occurredAt: Date;
    actor: {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null;
    metadata: unknown;
  }): RecentActivityItem {
    return {
      id: activityEvent.id,
      action: activityEvent.action,
      targetType: activityEvent.targetType,
      targetId: activityEvent.targetId,
      occurredAt: activityEvent.occurredAt.toISOString(),
      actor: activityEvent.actor,
      ...(activityEvent.metadata !== null
        ? { metadata: activityEvent.metadata }
        : {}),
    };
  }

  private toFollowUpAction(
    followUp: {
      id: string;
      dueAt: Date;
      lead: { id: string; fullName: string } | null;
      customer: { id: string; fullName: string } | null;
    },
    now: Date,
  ): PendingActionItem {
    const label = this.toContactLabel(followUp);
    const dueAt = followUp.dueAt.toISOString();

    return {
      id: `follow-up:${followUp.id}`,
      type: 'FOLLOW_UP',
      priority: this.toDatePriority(followUp.dueAt, now),
      title: `Follow-up due for ${label}`,
      dueAt,
      entity: {
        type: 'FollowUp',
        id: followUp.id,
        label,
      },
    };
  }

  private toKycAction(kyc: {
    id: string;
    booking: {
      id: string;
      lead: { fullName: string } | null;
      customer: { fullName: string } | null;
      project: { projectName: string };
      plot: { plotNumber: string };
    };
  }): PendingActionItem {
    const label = this.toBookingLabel(kyc.booking);

    return {
      id: `kyc-review:${kyc.id}`,
      type: 'KYC_REVIEW',
      priority: 'MEDIUM',
      title: `KYC pending for ${label}`,
      entity: {
        type: 'BookingKyc',
        id: kyc.id,
        label,
      },
    };
  }

  private toPaymentAction(payment: {
    id: string;
    booking: {
      id: string;
      lead: { fullName: string } | null;
      customer: { fullName: string } | null;
      project: { projectName: string };
      plot: { plotNumber: string };
    };
  }): PendingActionItem {
    const label = this.toBookingLabel(payment.booking);

    return {
      id: `payment-pending:${payment.id}`,
      type: 'PAYMENT_PENDING',
      priority: 'MEDIUM',
      title: `Payment pending for ${label}`,
      entity: {
        type: 'BookingPayment',
        id: payment.id,
        label,
      },
    };
  }

  private toSiteVisitAction(
    siteVisit: {
      id: string;
      scheduledAt: Date;
      lead: { id: string; fullName: string } | null;
      customer: { id: string; fullName: string } | null;
      project: { id: string; projectName: string } | null;
    },
    now: Date,
  ): PendingActionItem {
    const label = this.toSiteVisitLabel(siteVisit);

    return {
      id: `site-visit:${siteVisit.id}`,
      type: 'SITE_VISIT',
      priority: this.toDatePriority(siteVisit.scheduledAt, now),
      title: `Site visit scheduled for ${label}`,
      dueAt: siteVisit.scheduledAt.toISOString(),
      entity: {
        type: 'SiteVisit',
        id: siteVisit.id,
        label,
      },
    };
  }

  private toPlotBlockAction(
    plotBlock: {
      id: string;
      expiresAt: Date | null;
      customer: { fullName: string };
      project: { projectName: string };
      plot: { plotNumber: string };
    },
    now: Date,
  ): PendingActionItem {
    const label = this.toPlotBlockLabel(plotBlock);

    return {
      id: `plot-block-expiry:${plotBlock.id}`,
      type: 'PLOT_BLOCK_EXPIRY',
      priority: plotBlock.expiresAt
        ? this.toDatePriority(plotBlock.expiresAt, now)
        : 'LOW',
      title: `Plot block expiring for ${label}`,
      dueAt: plotBlock.expiresAt?.toISOString(),
      entity: {
        type: 'PlotBlock',
        id: plotBlock.id,
        label,
      },
    };
  }

  private comparePendingActions(
    left: PendingActionItem,
    right: PendingActionItem,
  ) {
    if (!left.dueAt && !right.dueAt) {
      return left.type.localeCompare(right.type);
    }

    if (!left.dueAt) {
      return 1;
    }

    if (!right.dueAt) {
      return -1;
    }

    return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  }

  private toDatePriority(dueAt: Date, now: Date): PendingActionPriority {
    if (dueAt.getTime() <= now.getTime()) {
      return 'HIGH';
    }

    if (dueAt.getTime() <= now.getTime() + ONE_DAY_MS) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  private toContactLabel(record: {
    lead?: { fullName: string } | null;
    customer?: { fullName: string } | null;
  }) {
    return record.customer?.fullName ?? record.lead?.fullName ?? 'Unassigned';
  }

  private toBookingLabel(booking: {
    id: string;
    lead: { fullName: string } | null;
    customer: { fullName: string } | null;
    project: { projectName: string };
    plot: { plotNumber: string };
  }) {
    const contactName = this.toContactLabel(booking);

    return `${contactName} - ${booking.project.projectName} / Plot ${booking.plot.plotNumber}`;
  }

  private toSiteVisitLabel(siteVisit: {
    lead: { fullName: string } | null;
    customer: { fullName: string } | null;
    project: { projectName: string } | null;
  }) {
    const contactName = this.toContactLabel(siteVisit);

    if (!siteVisit.project) {
      return contactName;
    }

    return `${contactName} - ${siteVisit.project.projectName}`;
  }

  private toPlotBlockLabel(plotBlock: {
    customer: { fullName: string };
    project: { projectName: string };
    plot: { plotNumber: string };
  }) {
    return `${plotBlock.customer.fullName} - ${plotBlock.project.projectName} / Plot ${plotBlock.plot.plotNumber}`;
  }
}
