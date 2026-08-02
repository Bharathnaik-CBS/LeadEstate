import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { CancelPlotBlockDto } from './dto/cancel-plot-block.dto';
import { CreatePlotBlockDto } from './dto/create-plot-block.dto';
import { CreatePlotDto } from './dto/create-plot.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdatePlotStatusDto } from './dto/update-plot-status.dto';
import { UpdatePlotDto } from './dto/update-plot.dto';
import { UpdatePlotPriceDto } from './dto/update-plot-price.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @Permissions(PERMISSIONS.PROJECTS.VIEW)
  findAll() {
    return this.projectsService.findAll();
  }

  @Post()
  @Permissions(PERMISSIONS.PROJECTS.CREATE)
  create(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.create(createProjectDto, user);
  }

  @Patch(':projectId')
  @Permissions(PERMISSIONS.PROJECTS.UPDATE)
  updateProject(
    @Param('projectId') projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.updateProject(projectId, updateProjectDto, user);
  }

  @Get(':projectId/layout')
  @Permissions(PERMISSIONS.PROJECTS.VIEW)
  findLayout(@Param('projectId') projectId: string) {
    return this.projectsService.findLayout(projectId);
  }

  @Put(':projectId/layout')
  @Permissions(PERMISSIONS.PROJECTS.UPDATE)
  updateLayout(
    @Param('projectId') projectId: string,
    @Body() layoutJson: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.updateLayout(projectId, layoutJson, user);
  }

  @Get(':id/plots')
  @Permissions(PERMISSIONS.PLOTS.VIEW)
  findPlots(@Param('id') id: string) {
    return this.projectsService.findPlots(id);
  }

  @Post(':id/plots')
  @Permissions(PERMISSIONS.PLOTS.CREATE)
  addPlot(
    @Param('id') id: string,
    @Body() createPlotDto: CreatePlotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.addPlot(id, createPlotDto, user);
  }

  @Patch(':projectId/plots/:plotId')
  @Permissions(PERMISSIONS.PLOTS.UPDATE)
  updatePlot(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
    @Body() updatePlotDto: UpdatePlotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.updatePlot(projectId, plotId, updatePlotDto, user);
  }

  @Patch(':projectId/plots/:plotId/status')
  @Permissions(PERMISSIONS.PLOTS.UPDATE_STATUS)
  updatePlotStatus(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
    @Body() updatePlotStatusDto: UpdatePlotStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.updatePlotStatus(
      projectId,
      plotId,
      updatePlotStatusDto,
      user,
    );
  }

  @Patch(':projectId/plots/:plotId/price')
  @Permissions(PERMISSIONS.PLOTS.UPDATE)
  updatePlotPrice(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
    @Body() updatePlotPriceDto: UpdatePlotPriceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.updatePlotPrice(
      projectId,
      plotId,
      updatePlotPriceDto,
      user,
    );
  }

  @Get(':projectId/plots/:plotId/price-history')
  @Permissions(PERMISSIONS.PLOTS.VIEW)
  findPlotPriceHistory(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
  ) {
    return this.projectsService.findPlotPriceHistory(projectId, plotId);
  }

  @Post(':projectId/plots/:plotId/blocks')
  @Permissions(PERMISSIONS.PLOT_BLOCKS.CREATE)
  createPlotBlock(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
    @Body() createPlotBlockDto: CreatePlotBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.createPlotBlock(
      projectId,
      plotId,
      createPlotBlockDto,
      user,
    );
  }

  @Get(':projectId/plots/:plotId/blocks')
  @Permissions(PERMISSIONS.PLOT_BLOCKS.VIEW)
  getPlotBlocks(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
  ) {
    return this.projectsService.getPlotBlocks(projectId, plotId);
  }

  @Post(':projectId/plots/:plotId/blocks/:blockId/booking')
  @Permissions(PERMISSIONS.BOOKINGS.CREATE)
  convertPlotBlockToBooking(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
    @Param('blockId') blockId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.convertPlotBlockToBooking(
      projectId,
      plotId,
      blockId,
      user,
    );
  }

  @Patch(':projectId/plots/:plotId/blocks/:blockId/cancel')
  @Permissions(PERMISSIONS.PLOT_BLOCKS.CANCEL)
  cancelPlotBlock(
    @Param('projectId') projectId: string,
    @Param('plotId') plotId: string,
    @Param('blockId') blockId: string,
    @Body() cancelPlotBlockDto: CancelPlotBlockDto,
  ) {
    return this.projectsService.cancelPlotBlock(
      projectId,
      plotId,
      blockId,
      cancelPlotBlockDto,
    );
  }
}
