import { Module } from '@nestjs/common';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { Bill } from './entities/bill.entity';
import { OpenaiService } from 'src/openai/openai.service';
import { SmartBook } from 'src/common/entities/smart_book.entity';
import { HttpRequest } from 'src/http-request/http-request.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bill]),
    TypeOrmModule.forFeature([SmartBook]),
  ],
  controllers: [BillsController],
  providers: [BillsService, RabbitmqService, OpenaiService, HttpRequest],
  exports: [BillsService],
})
export class BillsModule {}
