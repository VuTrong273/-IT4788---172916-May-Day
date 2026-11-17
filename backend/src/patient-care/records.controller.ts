import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  HttpCode,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { PatientRecordsService } from './records.service.js';

@Controller('api/v1/medical_records')
export class PatientRecordsController {
  constructor(private readonly service: PatientRecordsService) {}
  @Get('classify-questions') questions() {
    return this.service.classificationQuestions();
  }
  @Post('classify') @HttpCode(200) classify(@Body() body: unknown) {
    return this.service.classify(body);
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.create(req.user, body);
  }
  @Get('patients/:id/history') history(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.history(req.user, id);
  }
  @Get(':id/answers') answers(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.answers(req.user, id);
  }
  @Put(':id/answers') save(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.answers(req.user, id, body);
  }
  @Put(':id') complete(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.complete(req.user, id, body);
  }
  @Delete(':id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.remove(req.user, id);
  }
}
