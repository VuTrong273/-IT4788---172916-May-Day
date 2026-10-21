import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UserRepository } from '../auth/user.repository.js';

@Injectable()
export class ProfileService {
  constructor(private readonly users: UserRepository) {}

  async getProfile(userId: number) {
    let profile;
    try {
      profile = await this.users.findProfile(userId);
    } catch {
      throw new HttpException(
        { code: '9902', message: 'Database error', data: {} },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!profile) {
      throw new HttpException(
        { code: '3007', message: 'User account not found', data: {} },
        HttpStatus.NOT_FOUND,
      );
    }
    return { code: '1000', message: 'OK', data: profile };
  }
}
