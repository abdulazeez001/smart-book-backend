import { Injectable, OnModuleInit } from '@nestjs/common';
import amqp, {
  AmqpConnectionManager,
  ChannelWrapper,
} from 'amqp-connection-manager';
import { ConsumeMessage, ConfirmChannel } from 'amqplib';
import { queueTopology } from '../common/utils/queue-topology';
import { ScrapersService } from 'src/scraper/scraper.service';

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
  private scrapeService: ScrapersService;
  constructor(scrapeService: ScrapersService) {
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
                const maxRetries = 5;
                let retryCount = 0;
                if (
                  msg.properties.headers &&
                  msg.properties.headers['x-retry-count']
                ) {
                  retryCount = msg.properties.headers['x-retry-count'];
                }

                try {
                  const content = JSON.parse(msg.content.toString());
                  // Attach retryCount and maxRetries to the content
                  const enrichedContent = {
                    ...content,
                    retryCount,
                    maxRetries,
                  };
                  console.log(`Received message for worker: ${worker}`);

                  // Handle message logic here per worker
                  await this.handleMessage(worker, enrichedContent);

                  channel.ack(msg);
                } catch (err) {
                  console.log({ err });
                  console.error('Failed to process message:', err);

                  // Retry logic with a limit and delay
                  if (retryCount <= maxRetries) {
                    const baseDelayMs = 5000;
                    const retryDelayMs = baseDelayMs * Math.pow(2, retryCount);

                    setTimeout(() => {
                      // Republish with incremented retry count
                      channel.publish(
                        msg.fields.exchange,
                        msg.fields.routingKey,
                        msg.content,
                        {
                          headers: {
                            ...msg.properties.headers,
                            'x-retry-count': retryCount + 1,
                          },
                          persistent: true,
                        },
                      );
                      // Remove the message from the queue
                      channel.nack(msg, false, false);
                    }, retryDelayMs);
                  } else {
                    // Discard the message after max retries
                    console.error(
                      `Message discarded after ${maxRetries} retries`,
                    );
                    channel.nack(msg, false, false); // reject and discard
                  }
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
        await this.scrapeService.scrapeData({
          ...message.data,
          retryCount: message.retryCount,
          maxRetries: message.maxRetries,
        });
        break;

      case 'summary':
        console.log('Processing summary worker:', message);
        await this.scrapeService.summerizer({
          ...message.data,
          retryCount: message.retryCount,
          maxRetries: message.maxRetries,
        });
        break;

      case 'webhook':
        // console.log('Processing webhook worker:', message);
        await this.scrapeService.webhook(message.data);
        break;
      default:
        throw new Error('Unhandled worker type');
    }
  }
}
