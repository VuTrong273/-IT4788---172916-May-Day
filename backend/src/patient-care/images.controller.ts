import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard.js';
import { Public } from '../auth/public.decorator.js';
import { ImagesService } from './images.service.js';
import {
  IMAGE_UPLOAD_LIMITS,
  MAX_UPLOAD_IMAGES,
  type UploadedImage,
} from './image-validation.js';

function origin(req: AuthenticatedRequest) {
  return `${req.protocol}://${req.get('host')}`;
}

@Controller('api/v1/image-attachments')
export class ImagesController {
  constructor(private readonly service: ImagesService) {}
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: IMAGE_UPLOAD_LIMITS }))
  upload(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: UploadedImage | undefined,
    @Body() body: unknown,
  ) {
    return this.service.upload(
      req.user,
      file ? [file] : [],
      body,
      origin(req),
      false,
    );
  }
  @Post('upload-multiple')
  @UseInterceptors(
    FilesInterceptor('images', MAX_UPLOAD_IMAGES, {
      limits: IMAGE_UPLOAD_LIMITS,
    }),
  )
  multiple(
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files: UploadedImage[],
    @Body() body: unknown,
  ) {
    return this.service.upload(req.user, files ?? [], body, origin(req), true);
  }
  @Get('user/:user_id') list(
    @Req() req: AuthenticatedRequest,
    @Param('user_id') id: string,
  ) {
    return this.service.list(req.user, id, origin(req));
  }
  @Delete(':id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.remove(req.user, id);
  }
}
@Controller('api/v1/answer-images')
export class AnswerImagesController {
  constructor(private readonly service: ImagesService) {}
  @Post() link(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.service.link(req.user, body, origin(req));
  }
  @Get(':answer_id') list(
    @Req() req: AuthenticatedRequest,
    @Param('answer_id') id: string,
  ) {
    return this.service.answerImages(req.user, id, origin(req));
  }
  @Delete(':id') remove(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.service.unlink(req.user, id);
  }
}
@Controller('api/v1/media-files')
export class MediaFilesController {
  constructor(private readonly service: ImagesService) {}
  @Public() @Get(':id') async read(
    @Param('id') id: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.read(id, expires, signature);
    response.set({
      'Content-Type': file.type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=60',
    });
    return new StreamableFile(file.stream);
  }
}
