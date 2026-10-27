import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { Uas7Service } from './uas7.service.js';

@Controller('api/v1/uas7-scores')
export class Uas7Controller {
  constructor(private readonly scores: Uas7Service) {}

  @Get('eligibility')
  eligibility(@Req() request: AuthenticatedRequest) {
    return this.scores.eligibility(request.user);
  }

  @Post()
  @HttpCode(201)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.scores.create(request.user, body);
  }

  @Get('patient/:patient_id')
  history(@Req() request: AuthenticatedRequest, @Param('patient_id') patientId: string) {
    return this.scores.history(request.user, patientId);
  }

  @Get('week/:patient_id')
  week(@Req() request: AuthenticatedRequest, @Param('patient_id') patientId: string,
    @Query('start_date') startDate?: string) {
    return this.scores.week(request.user, patientId, startDate);
  }
}
