import { Body, Controller, HttpCode, Post, Put, Req } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { Public } from './public.decorator.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Public()
  @HttpCode(201)
  signup(@Body() body: unknown) {
    return this.authService.signup(body);
  }

  @Post('login')
  @Public()
  login(@Body() body: unknown) {
    return this.authService.login(body);
  }

  @Post('recovery-email')
  @HttpCode(200)
  requestRecoveryEmail(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.authService.requestRecoveryEmail(request.user, body);
  }

  @Post('recovery-email/verify')
  @HttpCode(200)
  verifyRecoveryEmail(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.authService.verifyRecoveryEmail(request.user, body);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(200)
  forgotPassword(@Body() body: unknown) {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(200)
  resetPassword(@Body() body: unknown) {
    return this.authService.resetPassword(body);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user);
  }

  @Put('change-password')
  changePassword(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.authService.changePassword(request.user, body);
  }
}
