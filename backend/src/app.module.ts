import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { ProfileModule } from './profile/profile.module.js';
import { MedicalRecordsModule } from './medical-records/medical-records.module.js';

@Module({
  imports: [AuthModule, ProfileModule, MedicalRecordsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
