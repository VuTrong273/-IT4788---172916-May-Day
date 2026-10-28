import { Module } from '@nestjs/common';
import { DoctorPatientsController } from './doctor-patients.controller.js';
import { DoctorPatientsRepository } from './doctor-patients.repository.js';
import { DoctorPatientsService } from './doctor-patients.service.js';

@Module({
  controllers: [DoctorPatientsController],
  providers: [DoctorPatientsRepository, DoctorPatientsService],
})
export class DoctorPatientsModule {}
