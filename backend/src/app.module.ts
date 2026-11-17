import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { MedicalRecordsModule } from './medical-records/medical-records.module.js';
import { OperationsModule } from './operations.module.js';
import { PatientCareModule } from './patient-care/patient-care.module.js';

@Module({
  imports: [AuthModule, ProfileModule, PatientCareModule, MedicalRecordsModule, OperationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
