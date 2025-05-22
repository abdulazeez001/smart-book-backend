import { Injectable, OnModuleInit } from '@nestjs/common';
import amqp, {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import { ConsumeMessage, ConfirmChannel } from 'amqplib';
import { queueTopology } from '../common/utils/queue-topology';
import { BillsService } from 'src/bills/bills.service';

const isTls = process.env.RABBITMQ_ISTLS === 'true';

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

@Injectable()
export class RabbitmqConsumerService implements OnModuleInit {
  private connection: AmqpConnectionManager;
  private consumerChannel: ChannelWrapper;
  private scrapeService: BillsService;
  constructor(scrapeService: BillsService) {
    this.scrapeService = scrapeService;
  }

  async onModuleInit() {
    this.connection = amqp.connect([connectionOptions]);
    this.consumerChannel = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        const workers = ['test', 'scraper', 'webhook', 'summary'];

        for (const worker of workers) {
          const { queue, exchange, routing_key } = queueTopology(worker);

          await channel.assertExchange(exchange, 'topic', { durable: true });
          await channel.assertQueue(queue, { durable: true });
          await channel.bindQueue(queue, exchange, routing_key);

          await channel.consume(
            queue,
            async (msg: ConsumeMessage | null) => {
              if (msg) {
                try {
                  const content = JSON.parse(msg.content.toString());
                  console.log(`Received message for worker: ${worker}`);
                  console.log(content);

                  // Handle message logic here per worker
                  await this.handleMessage(worker, content);

                  channel.ack(msg);
                } catch (err) {
                  console.error('Failed to process message:', err);
                  channel.nack(msg, false, false); // reject and discard
                }
              }
            },
            { noAck: false },
          );
        }
      },
    });

    this.connection.on('connect', () => {
      console.log('Consumer connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      console.error('Consumer disconnected from RabbitMQ:', err);
    });
  }

  async handleMessage(worker: string, message: any) {
    switch (worker) {
      case 'test':
        console.log('Processing test worker:', message);
        break;
      case 'scraper':
        console.log('Processing scrape worker:', message);
        await this.scrapeService.scrapeData(message.data);
        break;

      case 'summary':
        console.log('Processing summary worker:', message);
        await this.scrapeService.summerizer(message.data);
        break;

      case 'webhook':
        console.log('Processing webhook worker:', message);
        await this.scrapeService.webhook(message.data);
        break;
      default:
        throw new Error('Unhandled worker type');
    }
  }
}
