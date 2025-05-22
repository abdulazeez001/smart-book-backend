import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import {
  ValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import { formatValidationError } from './common/helpers';
// import { PuppeteerManager } from './common/libs/puppeteer';
// import { PageService } from './common/libs/browserManager/page';
// import { BrowserManagerService } from './common/libs/browserManager/index';
// import { ConfigService } from '@nestjs/config';

// import browserManagerServiceInstance from './common/libs/browserManager/index';
// async function onSignal() {
//   console.log('Cleaning up resources...');
//   await browserManagerServiceInstance.drain();
//   await browserManagerServiceInstance.clear();
// }

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      exceptionFactory: (errors: ValidationError[]) => {
        const formattedErrors = errors.flatMap((error) =>
          formatValidationError(error),
        );
        return new BadRequestException(formattedErrors);
      },
      stopAtFirstError: true,
      whitelist: true, // Strips out properties that do not have any decorators
      forbidNonWhitelisted: true, // Throws an error if unknown fields are passed
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  const config = new DocumentBuilder()
    .setTitle('SMART BOOK API Documentation')
    .setDescription('Documentation for the SMART BOOK API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);
  app.enableCors();

  await app.listen(process.env.HTTP_PORT || 3000);
  // Graceful shutdown
  // const shutdown = async () => {
  //   console.log('Received shutdown signal, cleaning up...');
  //   await onSignal();
  //   await app.close();
  //   process.exit(0);
  // };

  // process.on('SIGINT', shutdown);
  // process.on('SIGTERM', shutdown);
}
bootstrap();
