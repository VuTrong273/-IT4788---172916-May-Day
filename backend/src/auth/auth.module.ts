import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserRepository } from './user.repository.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    UserRepository,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [UserRepository],
})
export class AuthModule {}
