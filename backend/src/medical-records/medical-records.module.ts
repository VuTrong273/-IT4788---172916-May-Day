import { Module } from '@nestjs/common';
import { MedicalRecordsController } from './medical-records.controller.js';
import { MedicalRecordsRepository } from './medical-records.repository.js';
import { MedicalRecordsService } from './medical-records.service.js';

@Module({
  controllers: [MedicalRecordsController],
  providers: [MedicalRecordsRepository, MedicalRecordsService],
})
export class MedicalRecordsModule {}
