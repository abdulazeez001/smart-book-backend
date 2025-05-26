import { Module, Global } from '@nestjs/common';
import amqp from 'amqp-connection-manager';
import { ConfirmChannel } from 'amqplib';
import 'dotenv/config';
import { RabbitmqConsumerService } from './rabbitmq.consumer';
import { ScrapersService } from 'src/scraper/scraper.service';
import { Process } from '../scraper/entities/scraper.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitmqService } from './rabbitmq.service';
import { OpenaiService } from 'src/openai/openai.service';
import { SmartBook } from 'src/common/entities/smart_book.entity';
import { HttpRequest } from 'src/http-request/http-request.service';

const logger = {
  info: console.info,
  error: console.error,
};

const isTls = process.env.RABBITMQ_ISTLS === 'true';
const queuePrefix = process.env.RABBITMQ_QUEUE_PREFIX;

const connectionOptions = {
  protocol: isTls ? 'amqps' : 'amqp',
  hostname: process.env.RABBITMQ_HOST,
  port: Number(process.env.RABBITMQ_PORT),
  username: process.env.RABBITMQ_USERNAME,
  password: process.env.RABBITMQ_PASSWORD,
  locale: 'en_US',
  frameMax: 0,
  heartbeat: 0,
  vhost: process.env.RABBITMQ_VHOST,
};

// Create a connection manager
logger.info('Connecting to RabbitMq...');
const connection = amqp.connect(connectionOptions);

connection.on('connect', () => logger.info('RabbitMq is connected!'));
connection.on('disconnect', () =>
  logger.info('RabbitMq disconnected. Retrying...'),
);

export const EXCHANGE_NAME = `${queuePrefix}.exchange`;
export const QUEUE = `${queuePrefix}.queue`;
export const ROUTING_KEY = `${queuePrefix}.route`;

// Create a channel wrapper
export const channelWrapper = connection.createChannel({
  json: true,
  setup(channel: ConfirmChannel) {
    return Promise.all([
      channel.assertExchange(EXCHANGE_NAME, 'topic', {
        durable: true,
      }),
      channel.assertQueue(QUEUE, { durable: true }),
      channel.bindQueue(QUEUE, EXCHANGE_NAME, ROUTING_KEY),
    ]);
  },
});

channelWrapper.on('connect', () => {
  logger.info('RabbitMq channel has connected');
});

channelWrapper.on('close', () => {
  logger.info('RabbitMq channel has closed');
});

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Process]),
    TypeOrmModule.forFeature([SmartBook]),
  ],
  providers: [
    {
      provide: 'RABBITMQ_CHANNEL_WRAPPER',
      useValue: channelWrapper,
    },
    RabbitmqConsumerService,
    SmartBook,
    ScrapersService,
    RabbitmqService,
    OpenaiService,
    HttpRequest,
  ],
  exports: ['RABBITMQ_CHANNEL_WRAPPER'],
})
export class RabbitMQModule {}
