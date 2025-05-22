import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PageService {
  private readonly logger = new Logger(PageService.name);
  private readonly scrapeUrl: string;
  constructor(private readonly configService: ConfigService) {
    this.scrapeUrl = this.configService.get<string>('SCRAPE_URL')!;
  }

  async getVerificationPage(browserPage: {
    page: any;
    browser: any;
  }): Promise<any> {
    try {
      const page = browserPage.page;
      await page.goto(this.scrapeUrl);
      await page.waitForSelector('.site-content');
      return page;
    } catch (error) {
      this.logger.error('Error in getVerificationPage', error.stack);
      await browserPage.browser.close();
      throw error;
    }
  }
}
