import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { TemplatesService } from './templates.service.js';

@Controller('api/v1/templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Put(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.templates.update(request.user, id, body);
  }

  @Delete(':id')
  delete(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.templates.delete(request.user, id);
  }

  @Get('all')
  list(@Query() query: Record<string, unknown>) {
    return this.templates.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Post()
  @HttpCode(201)
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.templates.create(request.user, body);
  }
}
