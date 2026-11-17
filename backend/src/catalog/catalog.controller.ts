import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Type,
} from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import type { Input } from '../common/validation.js';

// Each generated class has concrete routes so the existing RBAC guard sees
// /api/v1/branches/:id, etc., exactly as registered in the seed catalog.
function resourceController(key: string): Type {
  @Controller(`api/v1/${key}`)
  class ResourceController {
    constructor(
      @Inject(CatalogService) private readonly service: CatalogService,
    ) {}
    @Get() list(@Query() query: Input) {
      return this.service.list(key, query);
    }
    get(@Param('id') id: string) {
      return this.service.get(key, id);
    }
    @Post() create(@Body() body: unknown) {
      return this.service.write(key, body);
    }
    @Put(':id') update(@Param('id') id: string, @Body() body: unknown) {
      return this.service.write(key, body, id);
    }
    @Delete(':id') remove(@Param('id') id: string) {
      return this.service.remove(key, id);
    }
  }
  if (['branches', 'departments', 'rooms'].includes(key)) {
    Get(':id')(
      ResourceController.prototype,
      'get',
      Object.getOwnPropertyDescriptor(ResourceController.prototype, 'get')!,
    );
  }
  Object.defineProperty(ResourceController, 'name', {
    value: `${key}Controller`,
  });
  return ResourceController;
}
export const catalogControllers = [
  'branches',
  'departments',
  'rooms',
  'roles',
  'permissions',
  'api_endpoints',
].map(resourceController);
