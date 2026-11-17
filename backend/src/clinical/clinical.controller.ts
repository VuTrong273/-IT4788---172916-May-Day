import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { ClinicalService } from './clinical.service.js';

@Controller('api/v1')
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}
  @Post('prescriptions') prescribe(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clinical.createPrescription(body, req.user);
  }
  @Get('prescriptions/:medical_record_id') prescription(
    @Param('medical_record_id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clinical.getPrescription(id, req.user);
  }
  @Post('lab-requests') request(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clinical.createLabRequest(body, req.user);
  }
  @Get('lab-results/:record_id') results(
    @Param('record_id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clinical.getLabResults(id, req.user);
  }
  @Post('lab-results') enter(
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.clinical.enterResults(body, req.user);
  }
}
