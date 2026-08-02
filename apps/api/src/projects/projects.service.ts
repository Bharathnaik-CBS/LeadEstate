import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  BookingType,
  CustomerJourneyStatus,
  PlotBlockStatus,
  PlotStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancelPlotBlockDto } from './dto/cancel-plot-block.dto';
import { CreatePlotBlockDto } from './dto/create-plot-block.dto';
import { CreatePlotDto } from './dto/create-plot.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdatePlotStatusDto } from './dto/update-plot-status.dto';
import { UpdatePlotDto } from './dto/update-plot.dto';
import { UpdatePlotPriceDto } from './dto/update-plot-price.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

type ProjectReader = Pick<Prisma.TransactionClient, 'project'>;
type PlotReader = Pick<Prisma.TransactionClient, 'plot'>;
type LayoutJsonInput = Prisma.JsonNullValueInput | Prisma.InputJsonValue;

const projectInclude = {
  plots: {
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
};

const plotBlockInclude = {
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
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  blockedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

const bookingWorkflowInclude = {
  lead: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
    },
  },
  customer: {
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
  plotBlock: {
    select: {
      id: true,
      status: true,
      blockedAt: true,
      convertedAt: true,
    },
  },
  salesExecutive: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  payments: {
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
  kyc: true,
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createProjectDto: CreateProjectDto, user?: AuthenticatedUser) {
    const project = await this.prisma.project.create({
      data: {
        projectName: createProjectDto.projectName.trim(),
        location: createProjectDto.location.trim(),
        description: this.cleanText(createProjectDto.description),
        totalPlots: createProjectDto.totalPlots,
      },
      include: projectInclude,
    });

    await this.activityEventsService.log({
      action: 'project.created',
      targetType: 'Project',
      targetId: project.id,
      actorId: user?.userId,
      metadata: this.toProjectMetadata(project),
    });

    return project;
  }

  findAll() {
    return this.prisma.project.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: projectInclude,
    });
  }

  async updateProject(
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    user?: AuthenticatedUser,
  ) {
    const project = await this.ensureProject(projectId);

    const updatedProject = await this.prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        projectName: updateProjectDto.projectName?.trim(),
        location: updateProjectDto.location?.trim(),
        description: this.cleanText(updateProjectDto.description),
        totalPlots: updateProjectDto.totalPlots,
      },
      include: projectInclude,
    });

    await this.activityEventsService.log({
      action: 'project.updated',
      targetType: 'Project',
      targetId: updatedProject.id,
      actorId: user?.userId,
      metadata: this.toProjectMetadata(updatedProject, {
        ...(project.projectName !== updatedProject.projectName
          ? { previousProjectName: project.projectName }
          : {}),
        ...(project.location !== updatedProject.location
          ? { previousLocation: project.location }
          : {}),
      }),
    });

    return updatedProject;
  }

  async findLayout(projectId: string) {
    await this.ensureProject(projectId);

    const layout = await this.prisma.projectLayout.findUnique({
      where: {
        projectId,
      },
    });

    return layout?.layoutJson ?? {};
  }

  async updateLayout(
    projectId: string,
    layoutJson: unknown,
    user?: AuthenticatedUser,
  ) {
    await this.ensureProject(projectId);

    const layoutJsonInput = this.toLayoutJsonInput(layoutJson);
    const layout = await this.prisma.projectLayout.upsert({
      where: {
        projectId,
      },
      create: {
        projectId,
        layoutJson: layoutJsonInput,
      },
      update: {
        layoutJson: layoutJsonInput,
      },
    });

    await this.activityEventsService.log({
      action: 'project.layout_updated',
      targetType: 'Project',
      targetId: projectId,
      actorId: user?.userId,
      metadata: {
        projectId,
      },
    });

    return layout.layoutJson;
  }

  async addPlot(
    projectId: string,
    createPlotDto: CreatePlotDto,
    user?: AuthenticatedUser,
  ) {
    await this.ensureProject(projectId);

    try {
      const plot = await this.prisma.plot.create({
        data: {
          plotNumber: createPlotDto.plotNumber.trim(),
          size: this.cleanText(createPlotDto.size),
          facing: this.cleanText(createPlotDto.facing),
          price: createPlotDto.price,
          status: createPlotDto.status ?? PlotStatus.AVAILABLE,
          project: {
            connect: {
              id: projectId,
            },
          },
        },
        include: {
          project: true,
        },
      });

      await this.activityEventsService.log({
        action: 'plot.created',
        targetType: 'Plot',
        targetId: plot.id,
        actorId: user?.userId,
        metadata: this.toPlotMetadata(plot),
      });

      return plot;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Plot number already exists in this project');
      }

      throw error;
    }
  }

  async findPlots(projectId: string) {
    await this.ensureProject(projectId);

    return this.prisma.plot.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updatePlot(
    projectId: string,
    plotId: string,
    updatePlotDto: UpdatePlotDto,
    user?: AuthenticatedUser,
  ) {
    const plot = await this.ensurePlotBelongsToProject(
      this.prisma,
      projectId,
      plotId,
    );

    try {
      const updatedPlot = await this.prisma.plot.update({
        where: {
          id: plot.id,
        },
        data: {
          plotNumber: updatePlotDto.plotNumber?.trim(),
          size: this.cleanText(updatePlotDto.size),
          facing: this.cleanText(updatePlotDto.facing),
        },
        include: {
          project: true,
        },
      });

      await this.activityEventsService.log({
        action: 'plot.updated',
        targetType: 'Plot',
        targetId: updatedPlot.id,
        actorId: user?.userId,
        metadata: this.toPlotMetadata(updatedPlot, {
          ...(plot.plotNumber !== updatedPlot.plotNumber
            ? { previousPlotNumber: plot.plotNumber }
            : {}),
        }),
      });

      return updatedPlot;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Plot number already exists in this project');
      }

      throw error;
    }
  }

  async updatePlotStatus(
    projectId: string,
    plotId: string,
    updatePlotStatusDto: UpdatePlotStatusDto,
    user?: AuthenticatedUser,
  ) {
    const plot = await this.ensurePlotBelongsToProject(
      this.prisma,
      projectId,
      plotId,
    );

    const updatedPlot = await this.prisma.plot.update({
      where: {
        id: plot.id,
      },
      data: {
        status: updatePlotStatusDto.status,
      },
      include: {
        project: true,
      },
    });

    await this.activityEventsService.log({
      action: 'plot.status_changed',
      targetType: 'Plot',
      targetId: updatedPlot.id,
      actorId: user?.userId,
      metadata: this.toPlotMetadata(updatedPlot, {
        previousStatus: plot.status,
      }),
    });

    return updatedPlot;
  }

  updatePlotPrice(
    projectId: string,
    plotId: string,
    updatePlotPriceDto: UpdatePlotPriceDto,
    user?: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const plot = await this.ensurePlotBelongsToProject(tx, projectId, plotId);
      const reason = this.cleanText(updatePlotPriceDto.reason);

      const updatedPlot = await tx.plot.update({
        where: {
          id: plot.id,
        },
        data: {
          price: updatePlotPriceDto.newPrice,
          priceHistory: {
            create: {
              oldPrice: plot.price,
              newPrice: updatePlotPriceDto.newPrice,
              changedById: user?.userId,
              reason,
            },
          },
        },
        include: {
          project: true,
        },
      });

      await this.activityEventsService.log(
        {
          action: 'plot.price_changed',
          targetType: 'Plot',
          targetId: plot.id,
          actorId: user?.userId,
          metadata: {
            projectId,
            plotId: plot.id,
            plotNumber: plot.plotNumber,
            oldPrice: this.toJsonDecimal(plot.price),
            newPrice: updatePlotPriceDto.newPrice,
            ...(reason ? { reason } : {}),
          },
        },
        tx,
      );

      return updatedPlot;
    });
  }

  async findPlotPriceHistory(projectId: string, plotId: string) {
    const plot = await this.ensurePlotBelongsToProject(
      this.prisma,
      projectId,
      plotId,
    );

    return this.prisma.plotPriceHistory.findMany({
      where: {
        plotId: plot.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createPlotBlock(
    projectId: string,
    plotId: string,
    createPlotBlockDto: CreatePlotBlockDto,
    user: AuthenticatedUser,
  ) {
    const expiresAt = createPlotBlockDto.expiresAt
      ? new Date(createPlotBlockDto.expiresAt)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      await this.ensureProject(projectId, tx);
      const plot = await this.ensurePlotBelongsToProject(tx, projectId, plotId);

      const customer = await tx.customer.findUnique({
        where: {
          id: createPlotBlockDto.customerId,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      if (plot.status !== PlotStatus.AVAILABLE) {
        throw new BadRequestException('Only available plots can be blocked');
      }

      const claim = await tx.plot.updateMany({
        where: {
          id: plot.id,
          status: PlotStatus.AVAILABLE,
        },
        data: {
          status: PlotStatus.BLOCKED,
        },
      });

      if (claim.count !== 1) {
        throw new BadRequestException('Plot is no longer available');
      }

      const plotBlock = await tx.plotBlock.create({
        data: {
          project: {
            connect: {
              id: projectId,
            },
          },
          plot: {
            connect: {
              id: plot.id,
            },
          },
          customer: {
            connect: {
              id: customer.id,
            },
          },
          blockedBy: {
            connect: {
              id: user.userId,
            },
          },
          status: PlotBlockStatus.ACTIVE,
          expiresAt,
        },
        include: plotBlockInclude,
      });

      await this.activityEventsService.log(
        {
          action: 'plot_block.created',
          targetType: 'PlotBlock',
          targetId: plotBlock.id,
          actorId: user.userId,
          metadata: {
            projectId,
            plotId: plot.id,
            plotNumber: plot.plotNumber,
            customerId: customer.id,
            status: PlotBlockStatus.ACTIVE,
          },
        },
        tx,
      );

      return plotBlock;
    });
  }

  async cancelPlotBlock(
    projectId: string,
    plotId: string,
    plotBlockId: string,
    cancelPlotBlockDto: CancelPlotBlockDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureProject(projectId, tx);
      const plot = await this.ensurePlotBelongsToProject(tx, projectId, plotId);

      const plotBlock = await tx.plotBlock.findUnique({
        where: {
          id: plotBlockId,
        },
      });

      if (!plotBlock) {
        throw new NotFoundException('Plot block not found');
      }

      if (plotBlock.projectId !== projectId || plotBlock.plotId !== plot.id) {
        throw new BadRequestException(
          'Selected plot block does not belong to plot',
        );
      }

      if (plotBlock.status !== PlotBlockStatus.ACTIVE) {
        throw new BadRequestException('Only active plot blocks can be cancelled');
      }

      const cancellation = await tx.plotBlock.updateMany({
        where: {
          id: plotBlock.id,
          status: PlotBlockStatus.ACTIVE,
        },
        data: {
          status: PlotBlockStatus.CANCELLED,
          cancelledAt: new Date(),
          cancellationReason: this.cleanText(
            cancelPlotBlockDto.cancellationReason,
          ),
        },
      });

      if (cancellation.count !== 1) {
        throw new BadRequestException('Plot block is no longer active');
      }
      const cancellationReason = this.cleanText(
        cancelPlotBlockDto.cancellationReason,
      );

      if (plot.status === PlotStatus.BLOCKED) {
        await tx.plot.updateMany({
          where: {
            id: plot.id,
            status: PlotStatus.BLOCKED,
          },
          data: {
            status: PlotStatus.AVAILABLE,
          },
        });
      }

      const cancelledPlotBlock = await tx.plotBlock.findUnique({
        where: {
          id: plotBlock.id,
        },
        include: plotBlockInclude,
      });

      await this.activityEventsService.log(
        {
          action: 'plot_block.cancelled',
          targetType: 'PlotBlock',
          targetId: plotBlock.id,
          metadata: {
            projectId,
            plotId: plot.id,
            plotNumber: plot.plotNumber,
            customerId: plotBlock.customerId,
            status: PlotBlockStatus.CANCELLED,
            ...(cancellationReason ? { cancellationReason } : {}),
          },
        },
        tx,
      );

      return cancelledPlotBlock;
    });
  }

  async convertPlotBlockToBooking(
    projectId: string,
    plotId: string,
    plotBlockId: string,
    user: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureProject(projectId, tx);
      const plot = await this.ensurePlotBelongsToProject(tx, projectId, plotId);

      const plotBlock = await tx.plotBlock.findUnique({
        where: {
          id: plotBlockId,
        },
        include: {
          customer: {
            select: {
              id: true,
              sourceLeadId: true,
            },
          },
        },
      });

      if (!plotBlock) {
        throw new NotFoundException('Plot block not found');
      }

      if (plotBlock.projectId !== projectId || plotBlock.plotId !== plot.id) {
        throw new BadRequestException(
          'Selected plot block does not belong to plot',
        );
      }

      if (plotBlock.status !== PlotBlockStatus.ACTIVE) {
        throw new BadRequestException('Only active plot blocks can be booked');
      }

      if (plot.status !== PlotStatus.BLOCKED) {
        throw new BadRequestException('Only blocked plots can be booked');
      }

      const convertedAt = new Date();
      const conversion = await tx.plotBlock.updateMany({
        where: {
          id: plotBlock.id,
          status: PlotBlockStatus.ACTIVE,
        },
        data: {
          status: PlotBlockStatus.CONVERTED,
          convertedAt,
        },
      });

      if (conversion.count !== 1) {
        throw new BadRequestException('Plot block is no longer active');
      }

      const plotBooking = await tx.plot.updateMany({
        where: {
          id: plot.id,
          status: PlotStatus.BLOCKED,
        },
        data: {
          status: PlotStatus.BOOKED,
        },
      });

      if (plotBooking.count !== 1) {
        throw new BadRequestException('Plot is no longer blocked');
      }

      await tx.customer.update({
        where: {
          id: plotBlock.customerId,
        },
        data: {
          status: CustomerJourneyStatus.CUSTOMER,
        },
      });

      const booking = await tx.booking.create({
        data: {
          type: BookingType.BOOKED,
          bookingDate: convertedAt,
          lead: plotBlock.customer.sourceLeadId
            ? {
                connect: {
                  id: plotBlock.customer.sourceLeadId,
                },
              }
            : undefined,
          customer: {
            connect: {
              id: plotBlock.customerId,
            },
          },
          project: {
            connect: {
              id: projectId,
            },
          },
          plot: {
            connect: {
              id: plot.id,
            },
          },
          plotBlock: {
            connect: {
              id: plotBlock.id,
            },
          },
          salesExecutive: {
            connect: {
              id: user.userId,
            },
          },
        },
        include: bookingWorkflowInclude,
      });

      await this.activityEventsService.log(
        {
          action: 'plot_block.converted',
          targetType: 'PlotBlock',
          targetId: plotBlock.id,
          actorId: user.userId,
          metadata: {
            projectId,
            plotId: plot.id,
            plotNumber: plot.plotNumber,
            customerId: plotBlock.customerId,
            status: PlotBlockStatus.CONVERTED,
            bookingId: booking.id,
          },
        },
        tx,
      );

      return booking;
    });
  }

  async getPlotBlocks(projectId: string, plotId: string) {
    await this.ensureProject(projectId);
    const plot = await this.ensurePlotBelongsToProject(
      this.prisma,
      projectId,
      plotId,
    );

    return this.prisma.plotBlock.findMany({
      where: {
        projectId,
        plotId: plot.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: plotBlockInclude,
    });
  }

  private async ensureProject(
    projectId: string,
    prisma: ProjectReader = this.prisma,
  ) {
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async ensurePlotBelongsToProject(
    prisma: PlotReader,
    projectId: string,
    plotId: string,
  ) {
    const plot = await prisma.plot.findUnique({
      where: {
        id: plotId,
      },
    });

    if (!plot) {
      throw new NotFoundException('Plot not found');
    }

    if (plot.projectId !== projectId) {
      throw new BadRequestException('Selected plot does not belong to project');
    }

    return plot;
  }

  private cleanText(value?: string) {
    const trimmedValue = value?.trim();
    return trimmedValue || undefined;
  }

  private toProjectMetadata(
    project: {
      id: string;
      projectName: string;
      location: string;
      totalPlots: number | null;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      projectId: project.id,
      projectName: project.projectName,
      location: project.location,
      totalPlots: project.totalPlots,
      ...extra,
    };
  }

  private toPlotMetadata(
    plot: {
      id: string;
      projectId: string;
      plotNumber: string;
      status: PlotStatus;
      price?: unknown;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      projectId: plot.projectId,
      plotId: plot.id,
      plotNumber: plot.plotNumber,
      status: plot.status,
      ...(plot.price !== undefined
        ? { price: this.toJsonDecimal(plot.price) }
        : {}),
      ...extra,
    };
  }

  private toJsonDecimal(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    return value.toString();
  }

  private toLayoutJsonInput(layoutJson: unknown): LayoutJsonInput {
    if (layoutJson === undefined) {
      throw new BadRequestException('Layout JSON is required');
    }

    if (layoutJson === null) {
      return Prisma.JsonNull;
    }

    return layoutJson as Prisma.InputJsonValue;
  }
}
