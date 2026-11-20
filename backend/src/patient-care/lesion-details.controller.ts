import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { LesionDetailsService } from './lesion-details.service.js';

const origin = (req: AuthenticatedRequest) =>
  `${req.protocol}://${req.get('host')}`;

@Controller('api/v1/lesion-locations')
export class LesionLocationsController {
  constructor(private readonly service: LesionDetailsService) {}
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.createLocation(req.user, body);
  }
  @Get('episode/:episode_id') list(
    @Req() req: AuthenticatedRequest,
    @Param('episode_id') id: string,
  ) {
    return this.service.listLocations(req.user, id);
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.changeLocation(req.user, id, body);
  }
  @Delete(':id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.changeLocation(req.user, id);
  }
}

@Controller('api/v1/lesion-photos')
export class LesionPhotosController {
  constructor(private readonly service: LesionDetailsService) {}
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.createPhoto(req.user, body, origin(req));
  }
  @Get('location/:location_id') location(
    @Req() req: AuthenticatedRequest,
    @Param('location_id') id: string,
  ) {
    return this.service.listPhotos(req.user, id, true, origin(req));
  }
  @Get('episode/:episode_id') episode(
    @Req() req: AuthenticatedRequest,
    @Param('episode_id') id: string,
  ) {
    return this.service.listPhotos(req.user, id, false, origin(req));
  }
  @Patch(':id/milestone') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.changePhoto(req.user, id, origin(req), body);
  }
  @Delete(':id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.changePhoto(req.user, id, origin(req));
  }
}
