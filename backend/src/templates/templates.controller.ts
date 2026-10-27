import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { TemplatesService } from './templates.service.js';

@Controller('api/v1/templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get('all')
  list(@Query() query: Record<string, unknown>) { return this.templates.list(query); }

  @Post()
  @HttpCode(201)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.templates.create(request.user, body);
  }
}
