import { Module } from '@nestjs/common';
import { HttpRequest } from './http-request.service';

@Module({
  providers: [HttpRequest],
  exports: [HttpRequest],
})
export class HttpRequestModule {}
