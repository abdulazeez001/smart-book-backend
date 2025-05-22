import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as genericPool from 'generic-pool';
import retry from 'retry-as-promised';
import { PuppeteerManager } from '../puppeteer/index';
import { PageService } from './page';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BrowserManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserManagerService.name);
  private readonly browserPagePool: genericPool.Pool<any>;

  constructor(
    private readonly configService: ConfigService,
    private readonly puppeteerManager: PuppeteerManager,
    private readonly pageService: PageService,
  ) {
    const browserInstances =
      this.configService.get<number>('BROWSER_INSTANCES') || 1;

    const warningLog = (message: string, extra: any) => {
      this.logger.warn(message, { message: JSON.stringify(extra, null, 2) });
    };

    const factory = {
      create: () =>
        retry(
          async () => {
            const browserPage = await this.puppeteerManager.runPuppeteer();
            browserPage.page =
              await this.pageService.getVerificationPage(browserPage);
            return browserPage;
          },
          {
            max: 3,
            name: 'factory.create',
            report: warningLog,
          },
        ),
      destroy: (browserPage: any) => browserPage.browser.close(),
    };

    const options = {
      max: browserInstances,
      min: browserInstances,
    };

    this.browserPagePool = genericPool.createPool(factory, options);

    this.browserPagePool.on('factoryCreateError', (error) => {
      this.logger.error('Factory Create Error', error);
    });

    this.browserPagePool.on('factoryDestroyError', (error) => {
      this.logger.error('Factory Destroy Error', error);
    });
  }

  getPool(): genericPool.Pool<any> {
    return this.browserPagePool;
  }

  async onModuleDestroy() {
    await this.browserPagePool.drain();
    await this.browserPagePool.clear();
  }
}

const configService = new ConfigService();
const puppeteerManager = new PuppeteerManager(configService);
const pageService = new PageService(configService);
const browserManagerServiceInstance = new BrowserManagerService(
  configService,
  puppeteerManager,
  pageService,
);

export default browserManagerServiceInstance.getPool();
