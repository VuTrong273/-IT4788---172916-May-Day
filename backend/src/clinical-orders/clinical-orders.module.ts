import { Module } from '@nestjs/common';
import { ClinicalOrdersController } from './clinical-orders.controller.js';
import { ClinicalOrdersRepository } from './clinical-orders.repository.js';
import { ClinicalOrdersService } from './clinical-orders.service.js';

@Module({
  controllers: [ClinicalOrdersController],
  providers: [ClinicalOrdersRepository, ClinicalOrdersService],
})
export class ClinicalOrdersModule {}
