import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { MonitoringService } from './monitoring.service.js';

@Controller('api/v1/uas7-scores')
export class Uas7Controller {
  constructor(private readonly service: MonitoringService) {}
  @Get('eligibility') eligibility(@Req() req: AuthenticatedRequest) {
    return this.service.eligibility(req.user);
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.createScore(req.user, body);
  }
  @Get('patient/:patient_id') history(
    @Req() req: AuthenticatedRequest,
    @Param('patient_id') id: string,
  ) {
    return this.service.scores(req.user, id, false);
  }
  @Get('week/:patient_id') week(
    @Req() req: AuthenticatedRequest,
    @Param('patient_id') id: string,
    @Query('start_date') start?: string,
  ) {
    return this.service.scores(req.user, id, true, start);
  }
}

@Controller('api/v1/lesion-episodes')
export class LesionEpisodesController {
  constructor(private readonly service: MonitoringService) {}
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.createEpisode(req.user, body);
  }
  @Get('my') mine(
    @Req() req: AuthenticatedRequest,
    @Query('medical_record_id') id?: string,
  ) {
    return this.service.listEpisodes(req.user, id);
  }
  @Get('record/:medical_record_id') list(
    @Req() req: AuthenticatedRequest,
    @Param('medical_record_id') id: string,
  ) {
    return this.service.listEpisodes(req.user, id);
  }
  @Get(':id') get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.service.episode(req.user, id, 'get');
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.episode(req.user, id, 'patch', body);
  }
  @Delete(':id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.episode(req.user, id, 'delete');
  }
}
