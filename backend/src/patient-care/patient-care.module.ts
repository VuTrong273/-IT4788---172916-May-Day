import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service.js';
import { PatientAccessService } from './access.service.js';
import { PatientRecordsService } from './records.service.js';
import { PatientRecordsController } from './records.controller.js';
import { MonitoringService } from './monitoring.service.js';
import {
  LesionEpisodesController,
  Uas7Controller,
} from './monitoring.controller.js';
import { ImagesService } from './images.service.js';
import { LesionDetailsService } from './lesion-details.service.js';
import { LesionLocationsController, LesionPhotosController } from './lesion-details.controller.js';
import {
  AnswerImagesController,
  ImagesController,
  MediaFilesController,
} from './images.controller.js';

@Module({
  controllers: [
    PatientRecordsController,
    Uas7Controller,
    LesionEpisodesController,
    ImagesController,
    AnswerImagesController,
    MediaFilesController,
    LesionLocationsController,
    LesionPhotosController,
  ],
  providers: [
    DatabaseService,
    PatientAccessService,
    PatientRecordsService,
    MonitoringService,
    ImagesService,
    LesionDetailsService,
  ],
})
export class PatientCareModule {}
