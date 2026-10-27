import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { ClinicalOrdersService } from './clinical-orders.service.js';

@Controller('api/v1')
export class ClinicalOrdersController {
  constructor(private readonly orders: ClinicalOrdersService) {}

  @Post('prescriptions')
  @HttpCode(201)
  createPrescription(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.orders.createPrescription(request.user, body);
  }

  @Get('prescriptions/:medical_record_id')
  getPrescription(@Req() request: AuthenticatedRequest, @Param('medical_record_id') id: string) {
    return this.orders.getPrescription(request.user, id);
  }

  @Post('lab-requests')
  @HttpCode(201)
  createLabRequest(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.orders.createLabRequest(request.user, body);
  }

  @Get('lab-results/:record_id')
  listLabResults(@Req() request: AuthenticatedRequest, @Param('record_id') id: string) {
    return this.orders.listLabResults(request.user, id);
  }

  @Post('lab-results')
  @HttpCode(201)
  enterLabResults(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.orders.enterLabResults(request.user, body);
  }
}
