import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  BookingType,
  OnboardingStatus,
  PlotBlockStatus,
  PlotStatus,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService activity events', () => {
  let prisma: {
    $transaction: jest.Mock;
    project: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    projectLayout: {
      upsert: jest.Mock;
    };
    plot: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let tx: {
    project: {
      findUnique: jest.Mock;
    };
    plot: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    customer: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    plotBlock: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    booking: {
      create: jest.Mock;
    };
  };
  let activityEventsService: {
    log: jest.Mock;
  };
  let service: ProjectsService;

  beforeEach(() => {
    tx = {
      project: {
        findUnique: jest.fn(),
      },
      plot: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      plotBlock: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      booking: {
        create: jest.fn(),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: (txClient: typeof tx) => unknown) =>
        callback(tx),
      ),
      project: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      projectLayout: {
        upsert: jest.fn(),
      },
      plot: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    activityEventsService = {
      log: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    service = new ProjectsService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('logs project.created after creating a project', async () => {
    prisma.project.create.mockResolvedValue(createProject());

    await service.create(
      {
        projectName: 'Green Acres',
        location: 'North Block',
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'project.created',
      targetType: 'Project',
      targetId: 'project-1',
      actorId: 'user-1',
      metadata: {
        projectId: 'project-1',
        projectName: 'Green Acres',
        location: 'North Block',
        totalPlots: 20,
      },
    });
  });

  it('logs project.updated after updating a project', async () => {
    prisma.project.findUnique.mockResolvedValue(createProject());
    prisma.project.update.mockResolvedValue(
      createProject({
        projectName: 'Green Acres Phase 2',
      }),
    );

    await service.updateProject(
      'project-1',
      {
        projectName: 'Green Acres Phase 2',
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'project.updated',
      targetType: 'Project',
      targetId: 'project-1',
      actorId: 'user-1',
      metadata: {
        projectId: 'project-1',
        projectName: 'Green Acres Phase 2',
        location: 'North Block',
        totalPlots: 20,
        previousProjectName: 'Green Acres',
      },
    });
  });

  it('logs project.layout_updated after updating a layout', async () => {
    prisma.project.findUnique.mockResolvedValue(createProject());
    prisma.projectLayout.upsert.mockResolvedValue({
      id: 'layout-1',
      projectId: 'project-1',
      layoutJson: {
        rows: [],
      },
    });

    await service.updateLayout(
      'project-1',
      {
        rows: [],
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'project.layout_updated',
      targetType: 'Project',
      targetId: 'project-1',
      actorId: 'user-1',
      metadata: {
        projectId: 'project-1',
      },
    });
  });

  it('logs plot.created after creating a plot', async () => {
    prisma.project.findUnique.mockResolvedValue(createProject());
    prisma.plot.create.mockResolvedValue(createPlot());

    await service.addPlot(
      'project-1',
      {
        plotNumber: 'A-101',
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'plot.created',
      targetType: 'Plot',
      targetId: 'plot-1',
      actorId: 'user-1',
      metadata: {
        projectId: 'project-1',
        plotId: 'plot-1',
        plotNumber: 'A-101',
        status: PlotStatus.AVAILABLE,
        price: '100000.00',
      },
    });
  });

  it('logs plot.updated after updating a plot', async () => {
    prisma.plot.findUnique.mockResolvedValue(createPlot());
    prisma.plot.update.mockResolvedValue(
      createPlot({
        plotNumber: 'A-102',
      }),
    );

    await service.updatePlot(
      'project-1',
      'plot-1',
      {
        plotNumber: 'A-102',
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'plot.updated',
      targetType: 'Plot',
      targetId: 'plot-1',
      actorId: 'user-1',
      metadata: {
        projectId: 'project-1',
        plotId: 'plot-1',
        plotNumber: 'A-102',
        status: PlotStatus.AVAILABLE,
        price: '100000.00',
        previousPlotNumber: 'A-101',
      },
    });
  });

  it('logs plot.status_changed after updating a plot status', async () => {
    prisma.plot.findUnique.mockResolvedValue(createPlot());
    prisma.plot.update.mockResolvedValue(
      createPlot({
        status: PlotStatus.CANCELLED,
      }),
    );

    await service.updatePlotStatus(
      'project-1',
      'plot-1',
      {
        status: PlotStatus.CANCELLED,
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'plot.status_changed',
      targetType: 'Plot',
      targetId: 'plot-1',
      actorId: 'user-1',
      metadata: {
        projectId: 'project-1',
        plotId: 'plot-1',
        plotNumber: 'A-101',
        status: PlotStatus.CANCELLED,
        price: '100000.00',
        previousStatus: PlotStatus.AVAILABLE,
      },
    });
  });

  it('logs plot.price_changed inside the price update transaction', async () => {
    tx.plot.findUnique.mockResolvedValue(createPlot({ price: '100000.00' }));
    tx.plot.update.mockResolvedValue(createPlot({ price: '125000.00' }));

    await service.updatePlotPrice(
      'project-1',
      'plot-1',
      {
        newPrice: '125000.00',
        reason: 'Market revision',
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'plot.price_changed',
        targetType: 'Plot',
        targetId: 'plot-1',
        actorId: 'user-1',
        metadata: {
          projectId: 'project-1',
          plotId: 'plot-1',
          plotNumber: 'A-101',
          oldPrice: '100000.00',
          newPrice: '125000.00',
          reason: 'Market revision',
        },
      },
      tx,
    );
  });

  it('logs plot_block.created inside the block creation transaction', async () => {
    tx.project.findUnique.mockResolvedValue({ id: 'project-1' });
    tx.plot.findUnique.mockResolvedValue(createPlot());
    tx.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
    tx.plot.updateMany.mockResolvedValue({ count: 1 });
    tx.plotBlock.create.mockResolvedValue(createPlotBlock());

    await service.createPlotBlock(
      'project-1',
      'plot-1',
      {
        customerId: 'customer-1',
      },
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'plot_block.created',
        targetType: 'PlotBlock',
        targetId: 'block-1',
        actorId: 'user-1',
        metadata: {
          projectId: 'project-1',
          plotId: 'plot-1',
          plotNumber: 'A-101',
          customerId: 'customer-1',
          status: PlotBlockStatus.ACTIVE,
        },
      },
      tx,
    );
  });

  it('logs plot_block.cancelled inside the block cancellation transaction', async () => {
    tx.project.findUnique.mockResolvedValue({ id: 'project-1' });
    tx.plot.findUnique.mockResolvedValue(createPlot({ status: PlotStatus.BLOCKED }));
    tx.plotBlock.findUnique
      .mockResolvedValueOnce(createPlotBlock())
      .mockResolvedValueOnce({
        ...createPlotBlock(),
        status: PlotBlockStatus.CANCELLED,
      });
    tx.plotBlock.updateMany.mockResolvedValue({ count: 1 });
    tx.plot.updateMany.mockResolvedValue({ count: 1 });

    await service.cancelPlotBlock(
      'project-1',
      'plot-1',
      'block-1',
      {
        cancellationReason: 'Customer requested release',
      },
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'plot_block.cancelled',
        targetType: 'PlotBlock',
        targetId: 'block-1',
        metadata: {
          projectId: 'project-1',
          plotId: 'plot-1',
          plotNumber: 'A-101',
          customerId: 'customer-1',
          status: PlotBlockStatus.CANCELLED,
          cancellationReason: 'Customer requested release',
        },
      },
      tx,
    );
  });

  it('logs plot_block.converted inside the conversion transaction', async () => {
    tx.project.findUnique.mockResolvedValue({ id: 'project-1' });
    tx.plot.findUnique.mockResolvedValue(createPlot({ status: PlotStatus.BLOCKED }));
    tx.plotBlock.findUnique.mockResolvedValue({
      ...createPlotBlock(),
      customer: {
        id: 'customer-1',
        sourceLeadId: 'lead-1',
      },
    });
    tx.plotBlock.updateMany.mockResolvedValue({ count: 1 });
    tx.plot.updateMany.mockResolvedValue({ count: 1 });
    tx.customer.update.mockResolvedValue({});
    tx.booking.create.mockResolvedValue({
      id: 'booking-1',
      type: BookingType.BOOKED,
      plotBlockId: 'block-1',
    });

    await service.convertPlotBlockToBooking(
      'project-1',
      'plot-1',
      'block-1',
      createUser(),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith(
      {
        action: 'plot_block.converted',
        targetType: 'PlotBlock',
        targetId: 'block-1',
        actorId: 'user-1',
        metadata: {
          projectId: 'project-1',
          plotId: 'plot-1',
          plotNumber: 'A-101',
          customerId: 'customer-1',
          status: PlotBlockStatus.CONVERTED,
          bookingId: 'booking-1',
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

  function createPlot(
    overrides: Partial<{
      price: string | null;
      status: PlotStatus;
    }> = {},
  ) {
    return {
      id: 'plot-1',
      projectId: 'project-1',
      plotNumber: 'A-101',
      price: '100000.00',
      status: PlotStatus.AVAILABLE,
      ...overrides,
    };
  }

  function createPlotBlock() {
    return {
      id: 'block-1',
      projectId: 'project-1',
      plotId: 'plot-1',
      customerId: 'customer-1',
      status: PlotBlockStatus.ACTIVE,
    };
  }

  function createProject(
    overrides: Partial<{
      projectName: string;
      location: string;
      totalPlots: number | null;
    }> = {},
  ) {
    return {
      id: 'project-1',
      projectName: 'Green Acres',
      location: 'North Block',
      description: null,
      totalPlots: 20,
      plots: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
