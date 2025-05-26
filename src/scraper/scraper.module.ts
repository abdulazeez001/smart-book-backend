import { Module } from '@nestjs/common';
import { ScrapersService } from './scraper.service';
import { ScrapersController } from './scraper.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { Process } from './entities/scraper.entity';
import { OpenaiService } from 'src/openai/openai.service';
import { SmartBook } from 'src/common/entities/smart_book.entity';
import { HttpRequest } from 'src/http-request/http-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Process]),
    TypeOrmModule.forFeature([SmartBook]),
  ],
  controllers: [ScrapersController],
  providers: [ScrapersService, RabbitmqService, OpenaiService, HttpRequest],
  exports: [ScrapersService],
})
export class ScrapersModule {}
