import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import type { Input } from '../common/validation.js';
import { TemplatesService } from './templates.service.js';

@Controller('api/v1/templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}
  @Get('all') list(@Query() query: Input) {
    return this.templates.list(query);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.templates.get(id);
  }
  @Post() create(@Body() body: unknown, @Req() req: AuthenticatedRequest) {
    return this.templates.write(body, req.user.userId);
  }
  @Put(':id') update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.templates.write(body, req.user.userId, id);
  }
  @Delete(':id') remove(@Param('id') id: string) {
    return this.templates.remove('template', id);
  }
  @Post(':template_id/sections') createSection(
    @Param('template_id') id: string,
    @Body() body: unknown,
  ) {
    return this.templates.section(body, id);
  }
  @Put('sections/:id') updateSection(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.templates.section(body, undefined, id);
  }
  @Delete('sections/:id') deleteSection(@Param('id') id: string) {
    return this.templates.remove('section', id);
  }
  @Post('sections/:section_id/questions') createQuestion(
    @Param('section_id') id: string,
    @Body() body: unknown,
  ) {
    return this.templates.question(body, id);
  }
  @Put('questions/:id') updateQuestion(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.templates.question(body, undefined, id);
  }
  @Delete('questions/:id') deleteQuestion(@Param('id') id: string) {
    return this.templates.remove('question', id);
  }
}
