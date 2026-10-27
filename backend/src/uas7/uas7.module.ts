import { Module } from '@nestjs/common';
import { Uas7Controller } from './uas7.controller.js';
import { Uas7Repository } from './uas7.repository.js';
import { Uas7Service } from './uas7.service.js';

@Module({
  controllers: [Uas7Controller],
  providers: [Uas7Repository, Uas7Service],
})
export class Uas7Module {}
