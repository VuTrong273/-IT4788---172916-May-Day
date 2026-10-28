import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Header,
  HttpCode,
  HttpException,
  Param,
  Post,
  Req,
  UploadedFile,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { LesionsService } from './lesions.service.js';
import type { ImageUpload } from './lesions.validation.js';

@Catch(HttpException)
class UploadErrorFilter implements ExceptionFilter {
  catch(error: HttpException, host: ArgumentsHost) {
    const response = error.getResponse();
    if (typeof response === 'object' && response !== null && 'code' in response)
      return host
        .switchToHttp()
        .getResponse<Response>()
        .status(error.getStatus())
        .json(response);
    const code = error.getStatus() === 413 ? '6003' : '6004';
    return host
      .switchToHttp()
      .getResponse<Response>()
      .status(error.getStatus())
      .json({ code, message: error.message, data: {} });
  }
}

@Controller('api/v1')
export class LesionsController {
  constructor(private readonly lesions: LesionsService) {}
  @Get('lesion-episodes/my')
  my(@Req() req: AuthenticatedRequest) {
    return this.lesions.episodes(req.user);
  }
  @Get('lesion-episodes/patient/:patient_id')
  patientEpisodes(
    @Req() req: AuthenticatedRequest,
    @Param('patient_id') patientId: string,
  ) {
    return this.lesions.patientEpisodes(req.user, patientId);
  }
  @Get('lesion-episodes/record/:medical_record_id')
  episodes(
    @Req() req: AuthenticatedRequest,
    @Param('medical_record_id') recordId: string,
  ) {
    return this.lesions.episodes(req.user, recordId);
  }
  @Post('lesion-episodes')
  @HttpCode(201)
  createEpisode(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.lesions.createEpisode(req.user, body);
  }
  @Get('lesion-locations/episode/:episode_id')
  locations(
    @Req() req: AuthenticatedRequest,
    @Param('episode_id') episode: string,
  ) {
    return this.lesions.locations(req.user, episode);
  }
  @Post('lesion-locations')
  @HttpCode(201)
  createLocation(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.lesions.createLocation(req.user, body);
  }
  @Get('lesion-photos/episode/:episode_id')
  photos(
    @Req() req: AuthenticatedRequest,
    @Param('episode_id') episode: string,
  ) {
    return this.lesions.photos(req.user, episode);
  }
  @Post('lesion-photos')
  @HttpCode(201)
  createPhoto(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.lesions.createPhoto(req.user, body);
  }
  @Post('image-attachments/upload')
  @HttpCode(201)
  @UseFilters(UploadErrorFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 8 },
    }),
  )
  async upload(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @UploadedFile() file?: ImageUpload,
  ) {
    const response = await this.lesions.upload(
      req.user,
      body,
      file ? [file] : [],
    );
    return {
      code: response.code,
      message: response.message,
      data: response.data[0],
    };
  }
  @Post('image-attachments/upload-multiple')
  @HttpCode(201)
  @UseFilters(UploadErrorFilter)
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 8 },
    }),
  )
  uploadMultiple(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
    @UploadedFiles() files: ImageUpload[],
  ) {
    return this.lesions.upload(req.user, body, files);
  }
  @Get('image-attachments/:id/content')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  content(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.lesions.content(req.user, id);
  }
}
