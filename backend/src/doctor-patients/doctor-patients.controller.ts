import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { DoctorPatientsService } from './doctor-patients.service.js';

@Controller('api/v1/doctor/patients')
export class DoctorPatientsController {
  constructor(private readonly patients: DoctorPatientsService) {}

  @Get('search')
  search(
    @Req() request: AuthenticatedRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.patients.search(request.user, query);
  }

  @Post()
  @HttpCode(201)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.patients.create(request.user, body);
  }
}
