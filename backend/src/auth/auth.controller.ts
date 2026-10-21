import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
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
}
