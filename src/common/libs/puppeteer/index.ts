import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HTTPRequest, Browser, Page } from 'puppeteer';
import puppeteer, { VanillaPuppeteer } from 'puppeteer-extra';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

const blockedResourceTypes: string[] = [];

puppeteer.use(StealthPlugin());

@Injectable()
export class PuppeteerManager {
  private readonly logger = new Logger(PuppeteerManager.name);
  private timeout: NodeJS.Timeout | null = null;
  private readonly environment: string;
  private readonly scrapeUrl: string;
  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get<string>('NODE_ENV')!;
    this.scrapeUrl = this.configService.get<string>('SCRAPE_URL')!;
  }

  async runPuppeteer(): Promise<{ page: Page; browser: Browser }> {
    const launchOptions: Parameters<VanillaPuppeteer['launch']>[0] = {
      executablePath: puppeteer.executablePath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--window-size=1920,1080',
      ],
    };

    if (this.environment !== 'development') {
      launchOptions.headless = true;
      launchOptions.slowMo = 10;
    } else {
      launchOptions.headless = false;
    }

    let browser: Browser;
    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (err) {
      this.logger.error('Failed to launch Puppeteer', err);
      throw err;
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setRequestInterception(true);

    page.on('request', (request: HTTPRequest) => {
      if (this.timeout) clearTimeout(this.timeout);

      if (blockedResourceTypes.includes(request.resourceType())) {
        request.abort();
      } else {
        request.continue();
      }

      if (page.url() === this.scrapeUrl) {
        this.timeout = setTimeout(async () => {
          try {
            await page.reload();
          } catch (error) {
            if (this.timeout) clearTimeout(this.timeout);
          }
        }, 1140000);
      }
    });

    page.on('console', (msg: any) => {
      msg.args().forEach((arg: any, i: number) => {
        this.logger.log(`${i}: ${arg}`);
      });
    });

    return { page, browser };
  }
}
