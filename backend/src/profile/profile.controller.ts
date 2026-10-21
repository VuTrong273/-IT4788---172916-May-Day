import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { ProfileService } from './profile.service.js';

@Controller('api/v1/profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.profiles.getProfile(request.user.userId);
  }

  @Put()
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.profiles.updateProfile(request.user.userId, body);
  }
}
