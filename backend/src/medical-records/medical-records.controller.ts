import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { MedicalRecordsService } from './medical-records.service.js';

@Controller('api/v1/medical_records')
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}

  @Get('all')
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.records.list(request.user, query);
  }

  @Get(':id/summary')
  summary(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.summary(request.user, id);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.get(request.user, id);
  }

  @Post(':id/accept')
  accept(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.accept(request.user, id);
  }
}
