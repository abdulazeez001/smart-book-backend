import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { BillsModule } from './bills/bills.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OpenaiModule } from './openai/openai.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { HttpRequestModule } from './http-request/http-request.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true, // Makes the configuration available globally
    }),
    DatabaseModule,
    BillsModule,
    RabbitMQModule,
    OpenaiModule,
    HttpRequestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
