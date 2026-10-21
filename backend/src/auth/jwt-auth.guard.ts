import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { errors, jwtVerify } from 'jose';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { UserRepository } from './user.repository.js';

export interface AuthenticatedUser {
  userId: number;
  roleId: number;
  jti: string;
  expiresAt: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

function authError(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization) {
      return authError('3003', 'User not authenticated', HttpStatus.UNAUTHORIZED);
    }
    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) {
      return authError('3001', 'Token is invalid', HttpStatus.UNAUTHORIZED);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      return authError(
        '9901',
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    let payload;
    try {
      ({ payload } = await jwtVerify(match[1], new TextEncoder().encode(secret), {
        algorithms: ['HS256'],
        requiredClaims: ['sub', 'jti', 'iat', 'exp'],
      }));
    } catch (caught) {
      if (caught instanceof errors.JWTExpired) {
        return authError('3002', 'Token expired', HttpStatus.UNAUTHORIZED);
      }
      return authError('3001', 'Token is invalid', HttpStatus.UNAUTHORIZED);
    }

    const userId = Number(payload.sub);
    if (
      !Number.isSafeInteger(userId) ||
      userId < 1 ||
      !payload.jti ||
      (payload.issued_at_ms !== undefined &&
        (!Number.isSafeInteger(payload.issued_at_ms) ||
          payload.issued_at_ms < payload.iat! * 1000))
    ) {
      return authError('3001', 'Token is invalid', HttpStatus.UNAUTHORIZED);
    }

    let account;
    try {
      account = await this.users.findAuthState(userId, payload.jti);
    } catch {
      return authError('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!account) {
      return authError('3001', 'Token is invalid', HttpStatus.UNAUTHORIZED);
    }
    if (account.is_active !== 1) {
      return authError('3010', 'User account is deactivated', HttpStatus.FORBIDDEN);
    }
    if (account.is_blacklisted) {
      return authError('3001', 'Token is invalid', HttpStatus.UNAUTHORIZED);
    }
    if (
      account.password_changed_at &&
      (typeof payload.issued_at_ms === 'number'
        ? payload.issued_at_ms
        : payload.iat! * 1000) < account.password_changed_at.getTime()
    ) {
      return authError('3001', 'Token is invalid', HttpStatus.UNAUTHORIZED);
    }

    request.user = {
      userId,
      roleId: account.role_id,
      jti: payload.jti,
      expiresAt: payload.exp!,
    };

    const routePath: unknown = request.route?.path;
    if (typeof routePath !== 'string') {
      return authError('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    }

    let access;
    try {
      access = await this.users.findEndpointAccess(
        account.role_id,
        request.method,
        routePath,
      );
    } catch {
      return authError('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!access || (access.is_public !== 1 && !access.is_allowed)) {
      return authError('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
