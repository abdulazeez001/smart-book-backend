import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SmartBook } from '../common/entities/smart_book.entity';
import { Process } from '../scraper/entities/scraper.entity';

@Module({
  imports: [
    ConfigModule.forRoot(), // Ensure ConfigModule is available
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: configService.get<'postgres'>('DB_TYPE'),
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database:
          configService.get<string>('NODE_ENV') === 'test'
            ? configService.get<string>('DB_NAME_TEST')
            : configService.get<string>('DB_NAME'),
        entities: [SmartBook, Process],
        synchronize:
          configService.get<string>('NODE_ENV') === 'development' ||
          configService.get<string>('NODE_ENV') === 'test' ||
          configService.get<string>('NODE_ENV') === 'staging',
        logging: false,
        migrationsRun: false,
        // ssl: {
        //   rejectUnauthorized: false,
        // },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
