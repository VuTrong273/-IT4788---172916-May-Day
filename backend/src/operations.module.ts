import { Module } from '@nestjs/common';
import { DatabaseService } from './common/database.service.js';
import { CatalogService } from './catalog/catalog.service.js';
import { catalogControllers } from './catalog/catalog.controller.js';
import { AccessController } from './catalog/access.controller.js';
import { UsersController } from './users/users.controller.js';
import { UsersService } from './users/users.service.js';
import { TemplatesController } from './templates/templates.controller.js';
import { TemplatesService } from './templates/templates.service.js';
import { ClinicalController } from './clinical/clinical.controller.js';
import { ClinicalService } from './clinical/clinical.service.js';

@Module({
  controllers: [
    ...catalogControllers,
    AccessController,
    UsersController,
    TemplatesController,
    ClinicalController,
  ],
  providers: [
    DatabaseService,
    CatalogService,
    UsersService,
    TemplatesService,
    ClinicalService,
  ],
})
export class OperationsModule {}
