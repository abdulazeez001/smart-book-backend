import 'dotenv/config';
import { QueueTopologyInterface } from './interfaces';

export const queueTopology = (worker: string): QueueTopologyInterface => {
  const queue_prefix = process.env.RABBITMQ_QUEUE_PREFIX;
  const exchange = `${queue_prefix}.exchange`;
  let topology;
  switch (worker) {
    case 'test':
      topology = {
        queue: `${queue_prefix}.queue`,
        exchange,
        routing_key: `${queue_prefix}.route`,
      };
      break;
    case 'scraper':
      topology = {
        queue: `${queue_prefix}.scrape.queue`,
        exchange,
        routing_key: `${queue_prefix}.scrape.route`,
      };
      break;
    case 'webhook':
      topology = {
        queue: `${queue_prefix}.webhoook.queue`,
        exchange,
        routing_key: `${queue_prefix}.webhoook.route`,
      };
      break;
    case 'summary':
      topology = {
        queue: `${queue_prefix}.summary.queue`,
        exchange,
        routing_key: `${queue_prefix}.summary.route`,
      };
      break;
    default:
      throw new Error('Invalid queue: Something bad happened!');
  }

  return topology;
};

export const RETRY_EXCHANGE_NAME = 'retry.exchange';
