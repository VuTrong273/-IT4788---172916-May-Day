import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { MedicalRecordsModule } from './medical-records/medical-records.module.js';
import { TemplatesModule } from './templates/templates.module.js';
import { ClinicalOrdersModule } from './clinical-orders/clinical-orders.module.js';

@Module({
  imports: [AuthModule, ProfileModule, MedicalRecordsModule, TemplatesModule, ClinicalOrdersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
