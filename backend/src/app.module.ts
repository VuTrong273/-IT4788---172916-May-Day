import { Module } from '@nestjs/common';
import { LesionsModule } from './lesions/lesions.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { MedicalRecordsModule } from './medical-records/medical-records.module.js';
import { TemplatesModule } from './templates/templates.module.js';
import { ClinicalOrdersModule } from './clinical-orders/clinical-orders.module.js';
import { Uas7Module } from './uas7/uas7.module.js';
import { DoctorPatientsModule } from './doctor-patients/doctor-patients.module.js';

@Module({
  imports: [
    LesionsModule,
    AuthModule,
    ProfileModule,
    MedicalRecordsModule,
    TemplatesModule,
    ClinicalOrdersModule,
    Uas7Module,
    DoctorPatientsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
