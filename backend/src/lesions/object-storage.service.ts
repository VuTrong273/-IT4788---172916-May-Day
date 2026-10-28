import { Injectable } from '@nestjs/common';
import { Client } from 'minio';

@Injectable()
export class ObjectStorageService {
  private clientInstance?: Client;
  private get client() {
    return (this.clientInstance ??= new Client({
      endPoint: process.env.MINIO_ENDPOINT!,
      port: Number(process.env.MINIO_PORT),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY!,
      secretKey: process.env.MINIO_SECRET_KEY!,
    }));
  }
  private get bucket() {
    return process.env.MINIO_BUCKET!;
  }
  async put(key: string, buffer: Buffer, type: string) {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': type,
    });
  }
  async get(key: string) {
    return this.client.getObject(this.bucket, key);
  }
  async remove(key: string) {
    await this.client.removeObject(this.bucket, key);
  }
}
