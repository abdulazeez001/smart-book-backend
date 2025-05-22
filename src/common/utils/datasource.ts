import 'dotenv/config';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { SmartBook } from '../entities/smart_book.entity';
import { Bill } from '../../bills/entities/bill.entity';

export const connectionSource = new DataSource({
  type: process.env.DB_TYPE as 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database:
    process.env.NODE_ENV === 'test'
      ? process.env.DB_NAME_TEST
      : process.env.DB_NAME,
  logging: true,
  entities: [SmartBook, Bill],
  migrations: [join(__dirname, '/../../', 'database/migrations/**/*{.ts,.js}')],
  synchronize:
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'staging',
  migrationsRun: false,
});
