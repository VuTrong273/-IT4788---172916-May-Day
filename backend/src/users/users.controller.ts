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
import { UsersService } from './users.service.js';

@Controller('api/v1')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Post('admin/users') create(@Body() body: unknown) {
    return this.users.create(body, 'user');
  }
  @Post('auth/admin/create-staff') staff(@Body() body: unknown) {
    return this.users.create(body, 'staff');
  }
  @Get('admin/users') list(@Query() query: Input) {
    return this.users.list(query);
  }
  @Get('admin/users/:id') get(@Param('id') id: string) {
    return this.users.get(id);
  }
  @Put('admin/users/:id') update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.users.update(id, body, request.user);
  }
  @Put('admin/users/:id/assign') assign(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.users.assign(id, body);
  }
  @Delete('admin/users/:id') remove(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.users.remove(id, request.user);
  }
  @Get('doctor/patients/search') search(@Query() query: Input) {
    return this.users.list(query, true);
  }
  @Post('doctor/patients') patient(@Body() body: unknown) {
    return this.users.create(body, 'patient');
  }
}
