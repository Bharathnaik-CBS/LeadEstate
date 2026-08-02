import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  canCreateOwnBookingForLead,
  canViewBooking,
  throwForbiddenUnless,
} from '../auth/policies';
import {
  BookingKycStatus,
  BookingStatus,
  BookingType,
  LeadStatus,
  PaymentStatus,
  PlotStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CloseSaleDto } from './dto/close-sale.dto';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingKycDto } from './dto/update-booking-kyc.dto';

type BookingTransaction = Prisma.TransactionClient;

const bookingInclude = {
  lead: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
    },
  },
  project: {
    select: {
      id: true,
      projectName: true,
      location: true,
    },
  },
  plot: {
    select: {
      id: true,
      plotNumber: true,
      status: true,
    },
  },
  salesExecutive: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

const paymentInclude = {
  receivedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

const kycInclude = {
  verifiedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  rejectedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createBookingDto: CreateBookingDto, user: AuthenticatedUser) {
    const bookingDate = createBookingDto.bookingDate
      ? new Date(createBookingDto.bookingDate)
      : new Date();

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: {
          id: createBookingDto.leadId,
        },
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      throwForbiddenUnless(
        canCreateOwnBookingForLead(user, lead),
        'You are not allowed to create a booking for this lead',
      );

      await this.ensureLeadCanCreateBooking({
        tx,
        leadId: lead.id,
        status: lead.status,
        requestedType: createBookingDto.type,
      });

      const plot = await tx.plot.findUnique({
        where: {
          id: createBookingDto.plotId,
        },
      });

      if (!plot || plot.projectId !== createBookingDto.projectId) {
        throw new BadRequestException('Selected plot does not belong to project');
      }

      const status =
        createBookingDto.type === BookingType.BOOKED
          ? LeadStatus.BOOKED
          : LeadStatus.BLOCKED;
      const plotStatus =
        createBookingDto.type === BookingType.BOOKED
          ? PlotStatus.BOOKED
          : PlotStatus.BLOCKED;
      const interestedProjectIds = this.mergeProjectIds(
        lead.interestedProjectIds,
        createBookingDto.projectId,
      );

      await this.claimPlotForBooking({
        tx,
        plotId: plot.id,
        currentStatus: plot.status,
        requestedType: createBookingDto.type,
        nextStatus: plotStatus,
        leadId: lead.id,
      });

      const booking = await tx.booking.create({
        data: {
          type: createBookingDto.type,
          amountPaid: createBookingDto.amountPaid,
          bookingDate,
          lead: {
            connect: {
              id: lead.id,
            },
          },
          project: {
            connect: {
              id: createBookingDto.projectId,
            },
          },
          plot: {
            connect: {
              id: plot.id,
            },
          },
          salesExecutive: {
            connect: {
              id: user.userId,
            },
          },
        },
        include: bookingInclude,
      });

      await tx.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status,
          finalProjectId: createBookingDto.projectId,
          finalPlotId: plot.id,
          bookingAmount: createBookingDto.amountPaid,
          bookingDate,
          interestedProjectIds: {
            set: interestedProjectIds,
          },
        },
      });

      await tx.leadInterestedProject.createMany({
        data: [
          {
            leadId: lead.id,
            projectId: createBookingDto.projectId,
          },
        ],
        skipDuplicates: true,
      });

      await this.activityEventsService.log(
        {
          action: 'booking.created',
          targetType: 'Booking',
          targetId: booking.id,
          actorId: user.userId,
          metadata: this.toBookingMetadata(booking, {
            amountPaid: createBookingDto.amountPaid ?? null,
          }),
        },
        tx,
      );

      return booking;
    });
  }

  async findRecent(user: AuthenticatedUser) {
    const bookings = await this.prisma.booking.findMany({
      orderBy: {
        bookingDate: 'desc',
      },
      take: 10,
      include: bookingInclude,
    });

    for (const booking of bookings) {
      throwForbiddenUnless(
        canViewBooking(user, {
          salesExecutiveId: booking.salesExecutiveId,
        }),
        'You are not allowed to view this booking',
      );
    }

    return bookings;
  }

  async cancelBooking(
    bookingId: string,
    user: AuthenticatedUser,
    cancelBookingDto: CancelBookingDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: {
          id: bookingId,
        },
        select: {
          id: true,
          type: true,
          status: true,
          leadId: true,
          customerId: true,
          projectId: true,
          plotId: true,
          plot: {
            select: {
              status: true,
            },
          },
          salesExecutiveId: true,
          lead: {
            select: {
              assignedToId: true,
            },
          },
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      throwForbiddenUnless(
        canViewBooking(user, booking),
        'You are not allowed to view this booking',
      );

      if (booking.status === BookingStatus.CLOSED) {
        throw new BadRequestException('Closed bookings cannot be cancelled');
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Booking is already cancelled');
      }

      if (booking.status !== BookingStatus.ACTIVE) {
        throw new BadRequestException('Only active bookings can be cancelled');
      }

      const cancellationReason = this.cleanText(
        cancelBookingDto.cancellationReason,
      );

      if (!cancellationReason) {
        throw new BadRequestException('Cancellation reason is required');
      }

      const cancelledAt = new Date();
      const cancellation = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.ACTIVE,
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt,
          cancellationReason,
          cancelledById: user.userId,
        },
      });

      if (cancellation.count !== 1) {
        throw new BadRequestException('Booking is no longer active');
      }

      if (booking.plot.status === PlotStatus.BOOKED) {
        await tx.plot.updateMany({
          where: {
            id: booking.plotId,
            status: PlotStatus.BOOKED,
          },
          data: {
            status: PlotStatus.AVAILABLE,
          },
        });
      }

      await this.activityEventsService.log(
        {
          action: 'booking.cancelled',
          targetType: 'Booking',
          targetId: booking.id,
          actorId: user.userId,
          metadata: this.toBookingMetadata(booking, {
            status: BookingStatus.CANCELLED,
            cancellationReason,
          }),
        },
        tx,
      );

      return tx.booking.findUnique({
        where: {
          id: booking.id,
        },
        include: bookingInclude,
      });
    });
  }

  async closeSale(
    bookingId: string,
    user: AuthenticatedUser,
    closeSaleDto: CloseSaleDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: {
          id: bookingId,
        },
        select: {
          id: true,
          type: true,
          status: true,
          leadId: true,
          customerId: true,
          projectId: true,
          plotId: true,
          salesExecutiveId: true,
          lead: {
            select: {
              assignedToId: true,
            },
          },
        },
      });

      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      throwForbiddenUnless(
        canViewBooking(user, booking),
        'You are not allowed to view this booking',
      );

      if (booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('Cancelled bookings cannot be closed');
      }

      if (booking.status === BookingStatus.CLOSED) {
        throw new BadRequestException('Booking is already closed');
      }

      if (booking.status !== BookingStatus.ACTIVE) {
        throw new BadRequestException('Only active bookings can be closed');
      }

      if (booking.type !== BookingType.BOOKED) {
        throw new BadRequestException('Only booked bookings can be closed');
      }

      const closedAt = new Date();
      const closure = await tx.booking.updateMany({
        where: {
          id: booking.id,
          status: BookingStatus.ACTIVE,
        },
        data: {
          status: BookingStatus.CLOSED,
          closedAt,
          closedById: user.userId,
          closureNotes:
            closeSaleDto.closureNotes !== undefined
              ? this.cleanText(closeSaleDto.closureNotes) ?? null
              : undefined,
        },
      });

      if (closure.count !== 1) {
        throw new BadRequestException('Booking is no longer active');
      }

      await tx.plot.update({
        where: {
          id: booking.plotId,
        },
        data: {
          status: PlotStatus.SOLD,
        },
      });

      const closureNotes =
        closeSaleDto.closureNotes !== undefined
          ? this.cleanText(closeSaleDto.closureNotes) ?? null
          : null;

      await this.activityEventsService.log(
        {
          action: 'booking.closed',
          targetType: 'Booking',
          targetId: booking.id,
          actorId: user.userId,
          metadata: this.toBookingMetadata(booking, {
            status: BookingStatus.CLOSED,
            closureNotes,
          }),
        },
        tx,
      );

      return tx.booking.findUnique({
        where: {
          id: booking.id,
        },
        include: bookingInclude,
      });
    });
  }

  async createPayment(
    bookingId: string,
    createPaymentDto: CreateBookingPaymentDto,
    user: AuthenticatedUser,
  ) {
    const booking = await this.ensureBookingCanBeViewed(bookingId, user);

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.bookingPayment.create({
        data: {
          booking: {
            connect: {
              id: bookingId,
            },
          },
          receivedBy: {
            connect: {
              id: user.userId,
            },
          },
          amount: createPaymentDto.amount,
          method: createPaymentDto.method,
          status: createPaymentDto.status ?? PaymentStatus.COMPLETED,
          paidAt: createPaymentDto.paymentDate
            ? new Date(createPaymentDto.paymentDate)
            : undefined,
          referenceNumber: this.cleanText(createPaymentDto.referenceNumber),
          notes: this.cleanText(createPaymentDto.notes),
        },
        include: paymentInclude,
      });

      await this.activityEventsService.log(
        {
          action: 'payment.created',
          targetType: 'BookingPayment',
          targetId: payment.id,
          actorId: user.userId,
          metadata: this.toBookingMetadata(booking, {
            amount: createPaymentDto.amount,
            method: createPaymentDto.method,
            status: payment.status,
          }),
        },
        tx,
      );

      return payment;
    });
  }

  async findPayments(bookingId: string, user: AuthenticatedUser) {
    await this.ensureBookingCanBeViewed(bookingId, user);

    return this.prisma.bookingPayment.findMany({
      where: {
        bookingId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: paymentInclude,
    });
  }

  async getKyc(bookingId: string, user: AuthenticatedUser) {
    await this.ensureBookingCanBeViewed(bookingId, user);

    return this.prisma.bookingKyc.upsert({
      where: {
        bookingId,
      },
      create: {
        booking: {
          connect: {
            id: bookingId,
          },
        },
        status: BookingKycStatus.NOT_STARTED,
      },
      update: {},
      include: kycInclude,
    });
  }

  async updateKyc(
    bookingId: string,
    updateKycDto: UpdateBookingKycDto,
    user: AuthenticatedUser,
  ) {
    const booking = await this.ensureBookingCanBeViewed(bookingId, user);

    const reviewData = this.getKycReviewData(updateKycDto.status, user);

    return this.prisma.$transaction(async (tx) => {
      const kyc = await tx.bookingKyc.upsert({
        where: {
          bookingId,
        },
        create: {
          booking: {
            connect: {
              id: bookingId,
            },
          },
          status: updateKycDto.status ?? BookingKycStatus.NOT_STARTED,
          notes: this.cleanText(updateKycDto.notes),
          rejectionReason: this.cleanText(updateKycDto.rejectionReason),
          ...reviewData,
        },
        update: {
          status: updateKycDto.status,
          notes:
            updateKycDto.notes !== undefined
              ? this.cleanText(updateKycDto.notes) ?? null
              : undefined,
          rejectionReason:
            updateKycDto.rejectionReason !== undefined
              ? this.cleanText(updateKycDto.rejectionReason) ?? null
              : undefined,
          ...reviewData,
        },
        include: kycInclude,
      });

      await this.activityEventsService.log(
        {
          action: 'kyc.updated',
          targetType: 'BookingKyc',
          targetId: kyc.id,
          actorId: user.userId,
          metadata: this.toBookingMetadata(booking, {
            status: kyc.status,
          }),
        },
        tx,
      );

      return kyc;
    });
  }

  private async ensureLeadCanCreateBooking({
    tx,
    leadId,
    status,
    requestedType,
  }: {
    tx: BookingTransaction;
    leadId: string;
    status: LeadStatus;
    requestedType: BookingType;
  }) {
    if (status === LeadStatus.CANCELLED) {
      throw new BadRequestException(
        'Cancelled leads cannot create a booking',
      );
    }

    if (status !== LeadStatus.BOOKED) {
      return;
    }

    if (requestedType !== BookingType.BOOKED) {
      throw new BadRequestException('Booked leads cannot create a block');
    }

    const existingBookedBooking = await tx.booking.findFirst({
      where: {
        leadId,
        type: BookingType.BOOKED,
      },
      select: {
        id: true,
      },
    });

    if (existingBookedBooking) {
      throw new BadRequestException('Lead already has a booking');
    }
  }

  private async claimPlotForBooking({
    tx,
    plotId,
    currentStatus,
    requestedType,
    nextStatus,
    leadId,
  }: {
    tx: BookingTransaction;
    plotId: string;
    currentStatus: PlotStatus;
    requestedType: BookingType;
    nextStatus: PlotStatus;
    leadId: string;
  }) {
    const allowedStatus = await this.getAllowedPlotClaimStatus({
      tx,
      plotId,
      currentStatus,
      requestedType,
      leadId,
    });

    const claim = await tx.plot.updateMany({
      where: {
        id: plotId,
        status: allowedStatus,
      },
      data: {
        status: nextStatus,
      },
    });

    if (claim.count !== 1) {
      throw new BadRequestException('Plot is no longer available');
    }
  }

  private async getAllowedPlotClaimStatus({
    tx,
    plotId,
    currentStatus,
    requestedType,
    leadId,
  }: {
    tx: BookingTransaction;
    plotId: string;
    currentStatus: PlotStatus;
    requestedType: BookingType;
    leadId: string;
  }) {
    if (currentStatus === PlotStatus.CANCELLED) {
      throw new BadRequestException('Cancelled plots cannot be booked');
    }

    if (currentStatus === PlotStatus.BOOKED) {
      throw new BadRequestException('Plot is already booked');
    }

    if (requestedType === BookingType.BLOCKED) {
      if (currentStatus !== PlotStatus.AVAILABLE) {
        throw new BadRequestException('Only available plots can be blocked');
      }

      return PlotStatus.AVAILABLE;
    }

    if (currentStatus === PlotStatus.AVAILABLE) {
      return PlotStatus.AVAILABLE;
    }

    if (currentStatus !== PlotStatus.BLOCKED) {
      throw new BadRequestException('Plot cannot be booked');
    }

    const existingBlocks = await tx.booking.findMany({
      where: {
        plotId,
        type: BookingType.BLOCKED,
      },
      select: {
        leadId: true,
      },
      take: 2,
    });

    if (existingBlocks.length !== 1 || existingBlocks[0].leadId !== leadId) {
      throw new BadRequestException(
        'Blocked plots can only be booked by the lead that owns the block',
      );
    }

    return PlotStatus.BLOCKED;
  }

  private mergeProjectIds(existingProjectIds: string[], projectId: string) {
    return Array.from(new Set([...existingProjectIds, projectId]));
  }

  private async ensureBookingCanBeViewed(
    bookingId: string,
    user: AuthenticatedUser,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
      select: {
        id: true,
        type: true,
        status: true,
        leadId: true,
        customerId: true,
        projectId: true,
        plotId: true,
        salesExecutiveId: true,
        lead: {
          select: {
            assignedToId: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    throwForbiddenUnless(
      canViewBooking(user, booking),
      'You are not allowed to view this booking',
    );

    return booking;
  }

  private cleanText(value?: string) {
    const trimmedValue = value?.trim();
    return trimmedValue || undefined;
  }

  private toBookingMetadata(
    booking: {
      id: string;
      leadId: string | null;
      customerId: string | null;
      projectId: string;
      plotId: string;
      type?: BookingType;
      status?: BookingStatus;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      bookingId: booking.id,
      leadId: booking.leadId,
      customerId: booking.customerId,
      projectId: booking.projectId,
      plotId: booking.plotId,
      ...(booking.type ? { type: booking.type } : {}),
      ...(booking.status ? { status: booking.status } : {}),
      ...extra,
    };
  }

  private getKycReviewData(
    status: BookingKycStatus | undefined,
    user: AuthenticatedUser,
  ) {
    if (status === BookingKycStatus.VERIFIED) {
      return {
        verifiedAt: new Date(),
        verifiedBy: {
          connect: {
            id: user.userId,
          },
        },
      };
    }

    if (status === BookingKycStatus.REJECTED) {
      return {
        rejectedAt: new Date(),
        rejectedBy: {
          connect: {
            id: user.userId,
          },
        },
      };
    }

    return {};
  }
}
