import { Controller, Get, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { ProfileService } from './profile.service.js';

@Controller('api/v1/profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.profiles.getProfile(request.user.userId);
  }
}
