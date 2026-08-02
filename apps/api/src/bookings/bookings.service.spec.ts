import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  BookingKycStatus,
  BookingStatus,
  BookingType,
  LeadStatus,
  OnboardingStatus,
  PaymentMethod,
  PaymentStatus,
  PlotStatus,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from './bookings.service';

describe('BookingsService activity events', () => {
  let prisma: {
    $transaction: jest.Mock;
    booking: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
    };
    bookingPayment: {
      findMany: jest.Mock;
    };
  };
  let tx: {
    lead: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    plot: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    booking: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    bookingPayment: {
      create: jest.Mock;
    };
    bookingKyc: {
      upsert: jest.Mock;
    };
    leadInterestedProject: {
      createMany: jest.Mock;
    };
  };
  let activityEventsService: {
    log: jest.Mock;
  };
  let service: BookingsService;

  beforeEach(() => {
    tx = {
      lead: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      plot: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      booking: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      bookingPayment: {
        create: jest.fn(),
      },
      bookingKyc: {
        upsert: jest.fn(),
      },
      leadInterestedProject: {
        createMany: jest.fn(),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: (txClient: typeof tx) => unknown) =>
        callback(tx),
      ),
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      bookingPayment: {
        findMany: jest.fn(),
      },
    };
    activityEventsService = {
      log: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    service = new BookingsService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('logs booking.created inside the booking creation transaction', async () => {
    tx.lead.findUnique.mockResolvedValue(createLead());
    tx.plot.findUnique.mockResolvedValue(createPlot());
    tx.plot.updateMany.mockResolvedValue({ count: 1 });
    tx.booking.create.mockResolvedValue(createBooking());
    tx.lead.update.mockResolvedValue({});
    tx.leadInterestedProject.createMany.mockResolvedValue({ count: 1 });

    await service.create(
      {
        leadId: 'lead-1',
        projectId: 'project-1',
        plotId: 'plot-1',
        type: BookingType.BOOKED,
        amountPaid: 1000,
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'booking.created',
        targetType: 'Booking',
        targetId: 'booking-1',
        actorId: 'user-1',
        metadata: {
          bookingId: 'booking-1',
          leadId: 'lead-1',
          customerId: null,
          projectId: 'project-1',
          plotId: 'plot-1',
          type: BookingType.BOOKED,
          status: BookingStatus.ACTIVE,
          amountPaid: 1000,
        },
      },
      tx,
    );
  });

  it('logs booking.cancelled inside the cancellation transaction', async () => {
    tx.booking.findUnique
      .mockResolvedValueOnce(createBooking())
      .mockResolvedValueOnce({
        ...createBooking(),
        status: BookingStatus.CANCELLED,
      });
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.plot.updateMany.mockResolvedValue({ count: 1 });

    await service.cancelBooking(
      'booking-1',
      createUser(),
      {
        cancellationReason: 'Customer changed plan',
      },
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'booking.cancelled',
        targetType: 'Booking',
        targetId: 'booking-1',
        actorId: 'user-1',
        metadata: {
          bookingId: 'booking-1',
          leadId: 'lead-1',
          customerId: null,
          projectId: 'project-1',
          plotId: 'plot-1',
          type: BookingType.BOOKED,
          status: BookingStatus.CANCELLED,
          cancellationReason: 'Customer changed plan',
        },
      },
      tx,
    );
  });

  it('logs booking.closed inside the sale closure transaction', async () => {
    tx.booking.findUnique
      .mockResolvedValueOnce(createBooking())
      .mockResolvedValueOnce({
        ...createBooking(),
        status: BookingStatus.CLOSED,
      });
    tx.booking.updateMany.mockResolvedValue({ count: 1 });
    tx.plot.update.mockResolvedValue({});

    await service.closeSale(
      'booking-1',
      createUser(),
      {
        closureNotes: 'Agreement signed',
      },
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'booking.closed',
        targetType: 'Booking',
        targetId: 'booking-1',
        actorId: 'user-1',
        metadata: {
          bookingId: 'booking-1',
          leadId: 'lead-1',
          customerId: null,
          projectId: 'project-1',
          plotId: 'plot-1',
          type: BookingType.BOOKED,
          status: BookingStatus.CLOSED,
          closureNotes: 'Agreement signed',
        },
      },
      tx,
    );
  });

  it('logs payment.created in the payment transaction', async () => {
    prisma.booking.findUnique.mockResolvedValue(createBooking());
    tx.bookingPayment.create.mockResolvedValue({
      id: 'payment-1',
      bookingId: 'booking-1',
      amount: 500,
      method: PaymentMethod.UPI,
      status: PaymentStatus.COMPLETED,
    });

    await service.createPayment(
      'booking-1',
      {
        amount: 500,
        method: PaymentMethod.UPI,
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'payment.created',
        targetType: 'BookingPayment',
        targetId: 'payment-1',
        actorId: 'user-1',
        metadata: {
          bookingId: 'booking-1',
          leadId: 'lead-1',
          customerId: null,
          projectId: 'project-1',
          plotId: 'plot-1',
          type: BookingType.BOOKED,
          status: PaymentStatus.COMPLETED,
          amount: 500,
          method: PaymentMethod.UPI,
        },
      },
      tx,
    );
  });

  it('logs kyc.updated in the KYC transaction', async () => {
    prisma.booking.findUnique.mockResolvedValue(createBooking());
    tx.bookingKyc.upsert.mockResolvedValue({
      id: 'kyc-1',
      bookingId: 'booking-1',
      status: BookingKycStatus.VERIFIED,
    });

    await service.updateKyc(
      'booking-1',
      {
        status: BookingKycStatus.VERIFIED,
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'kyc.updated',
        targetType: 'BookingKyc',
        targetId: 'kyc-1',
        actorId: 'user-1',
        metadata: {
          bookingId: 'booking-1',
          leadId: 'lead-1',
          customerId: null,
          projectId: 'project-1',
          plotId: 'plot-1',
          type: BookingType.BOOKED,
          status: BookingKycStatus.VERIFIED,
        },
      },
      tx,
    );
  });

  function createUser(): AuthenticatedUser {
    return {
      userId: 'user-1',
      email: 'user@example.com',
      role: UserRole.SALES_EXECUTIVE,
      onboardingStatus: OnboardingStatus.ACTIVE,
    };
  }

  function createLead() {
    return {
      id: 'lead-1',
      status: LeadStatus.NEW,
      assignedToId: 'user-1',
      interestedProjectIds: [],
    };
  }

  function createPlot() {
    return {
      id: 'plot-1',
      projectId: 'project-1',
      status: PlotStatus.AVAILABLE,
    };
  }

  function createBooking() {
    return {
      id: 'booking-1',
      type: BookingType.BOOKED,
      status: BookingStatus.ACTIVE,
      leadId: 'lead-1',
      customerId: null,
      projectId: 'project-1',
      plotId: 'plot-1',
      salesExecutiveId: 'user-1',
      plot: {
        status: PlotStatus.BOOKED,
      },
      lead: {
        assignedToId: 'user-1',
      },
    };
  }
});
