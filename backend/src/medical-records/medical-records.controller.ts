import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { MedicalRecordsService } from './medical-records.service.js';

@Controller('api/v1/medical_records')
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}

  @Post()
  @HttpCode(201)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.records.create(request.user, body);
  }

  @Get('all')
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.records.list(request.user, query);
  }

  @Get('patients/:id/history')
  history(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.history(request.user, id);
  }

  @Get(':id/summary')
  summary(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.summary(request.user, id);
  }

  @Get(':id/answers')
  answers(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.answers(request.user, id);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.get(request.user, id);
  }

  @Put(':id/answers')
  upsertAnswers(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.records.upsertAnswers(request.user, id, body);
  }

  @Put(':id')
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.records.complete(request.user, id, body);
  }

  @Post(':id/accept')
  accept(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.records.accept(request.user, id);
  }
}
