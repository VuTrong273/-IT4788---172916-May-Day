import { Module } from '@nestjs/common';
import { LesionsController } from './lesions.controller.js';
import { LesionsService } from './lesions.service.js';
import { LesionsRepository } from './lesions.repository.js';
import { ObjectStorageService } from './object-storage.service.js';
@Module({
  controllers: [LesionsController],
  providers: [LesionsService, LesionsRepository, ObjectStorageService],
})
export class LesionsModule {}
