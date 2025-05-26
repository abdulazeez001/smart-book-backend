import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process } from './entities/scraper.entity';
import { SmartBook } from 'src/common/entities/smart_book.entity';
import {
  IInitializeScrape,
  ProductInfo,
} from './interfaces/scraper.interfaces';
// import { GetOperatorsDto } from './dto/get-operators.dto';
// import { Page } from 'puppeteer';
import { RabbitmqService } from 'src/rabbitmq/rabbitmq.service';
import browserPagePool from 'src/common/libs/browserManager';
import { OpenaiService } from 'src/openai/openai.service';
import { HttpRequest } from 'src/http-request/http-request.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ScrapersService {
  constructor(
    @InjectRepository(Process)
    private readonly processRepository: Repository<Process>,
    @InjectRepository(SmartBook)
    private readonly smartBookRepository: Repository<SmartBook>,

    private readonly configService: ConfigService,
    private readonly httpRequestService: HttpRequest,
    private readonly rabitmqService: RabbitmqService,
    private readonly openAIService: OpenaiService,
  ) {}

  async initiateScrape(search: string): Promise<IInitializeScrape> {
    // Generate a unique job ID containing the search term and ensure it doesn't exist in the DB
    let jobId: string;
    do {
      const randomStr = Math.random().toString(36).substring(2, 8);
      jobId = `job_${search}_${randomStr}`;
    } while (
      await this.processRepository.findOne({
        where: { job_id: jobId },
        select: ['job_id'],
      })
    );

    await this.rabitmqService.publishMessage([
      {
        worker: 'scraper',
        message: {
          action: 'scrape',
          type: 'page',
          data: {
            jobId,
            // productAnchors,
            search,
          },
        },
      },
    ]);

    // Save the process entry early to avoid duplicate jobs
    const response = await this.processRepository.save({
      job_id: jobId,
      search,
      processed_data: 0,
      total_expected_data: 0, // will update after scraping
      status: 'processing',
    });
    return {
      ...response,
    } as IInitializeScrape;
  }

  async scrapeData(payload: {
    jobId: string;
    productAnchors: any[];
    search: string;
    retryCount?: number;
    maxRetries?: number;
  }) {
    // Use a single browser instance and open new tabs for each page
    const browserPage = await browserPagePool.acquire();
    const pageNums = [1, 2];
    const scrapePage = async (pageNum: number) => {
      const page = await browserPage.browser.newPage();
      try {
        const url =
          pageNum === 1
            ? `https://bookdp.com.au/?s=${encodeURIComponent(payload.search.toLowerCase())}&post_type=product`
            : `https://bookdp.com.au/page/${pageNum}/?s=${encodeURIComponent(payload.search.toLowerCase())}&post_type=product`;

        await page.goto(url);
        await page.waitForSelector('li.product a', { timeout: 5000 });

        const productsOnPage = await page.$$eval(
          'li.product',
          (items: any[]) => {
            return items.map((item) => {
              // Helper to get text from selector
              const getText = (selector: string) => {
                const el = item.querySelector(selector);
                return el ? el.textContent?.trim() || null : null;
              };

              // Helper to get attribute from selector
              const getAttr = (selector: string, attr: string) => {
                const el = item.querySelector(selector);
                return el ? el.getAttribute(attr) : null;
              };

              // Extract details from the table
              const details: Record<string, string> = {};
              const tableRows = item.querySelectorAll(
                '.short-description table tr',
              );
              tableRows.forEach(
                (tr: { querySelector: (arg0: string) => any }) => {
                  const th = tr.querySelector('th');
                  const td = tr.querySelector('td');
                  if (th && td) {
                    details[
                      th.textContent!.replace(':', '').trim().toLowerCase()
                    ] = td.textContent?.trim() || '';
                  }
                },
              );

              // Extract prices
              const originalPrice = getText('.price del .amount bdi');
              const discountedPrice =
                getText('.price ins .amount bdi') ||
                getText('.price .amount bdi');

              return {
                href: getAttr('.product-thumbnail a', 'href'),
                image: getAttr('.product-thumbnail img', 'src'),
                title: getText('.woocommerce-loop-product__title a'),
                originalPrice,
                discountedPrice,
                publisher: details['publisher'] || null,
              };
            });
          },
        );

        await page.close();
        return productsOnPage;
      } catch (error) {
        await page.close();
        console.error(`Error scraping page ${pageNum}:`, error);
        return [];
      }
    };

    // Run all page scrapes in parallel
    let productAnchors: ProductInfo[] = [];
    try {
      const productPages = await Promise.all(pageNums.map(scrapePage));

      productAnchors = productPages.flat();
      // Extract all image URLs from the productAnchors
      const coverImgUrls = productAnchors
        .map((item) => item.image ?? '')
        .filter(Boolean);

      // Get authors for each image URL
      const authorsMap =
        await this.openAIService.getBatchAuthorsFromCoverImages(coverImgUrls);

      // Scrape each product page for more accurate and robust extraction
      for (const item of productAnchors) {
        const authors = authorsMap.get(item.image ?? '') ?? ['N/A'];
        item.author = authors;
        item.jobId = payload.jobId;
        item.search = payload.search;
        if (!item.href) continue;

        // Open a new page for each product link
        const page = await browserPage.browser.newPage();

        await page.goto(item.href, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await page.waitForSelector('.site-content', { timeout: 5000 });

        // Title
        item.title = await page
          .$eval(
            'h1.product_title.entry-title',
            (el: { textContent: string }) => el.textContent?.trim() || null,
          )
          .catch(() => item.title);
        item.originalPrice = await page
          .$eval(
            '.motta-price-stock .price del .amount bdi',
            (el: { textContent: string }) => el.textContent?.trim() || null,
          )
          .catch(() => null);

        // Description
        item.description = await page
          .$eval(
            '#tab-description .woocommerce-tabs--description-content',
            (el: { textContent: string }) => el.textContent?.trim() || null,
          )
          .catch(() => null);
      }

      // Update total_expected_data after scraping
      await this.processRepository.update(
        { job_id: payload.jobId },
        { total_expected_data: productAnchors.length },
      );

      const { jobId, search } = payload;

      await this.rabitmqService.publishMessage([
        {
          worker: 'summary',
          message: {
            action: 'summarize',
            type: 'page',
            data: {
              jobId,
              productAnchors,
              search,
            },
          },
        },
      ]);
    } catch (error) {
      // Check for max retry and update process status to 'failed'
      if (
        typeof payload.retryCount === 'number' &&
        typeof payload.maxRetries === 'number' &&
        payload.retryCount >= payload.maxRetries
      ) {
        await this.processRepository.update(
          { job_id: payload.jobId },
          { status: 'failed' },
        );
      }
      throw new Error('Failed scrapeData: ' + error.message);
    } finally {
      // Always release the browserPage back to the pool
      await browserPagePool.destroy(browserPage);
    }
  }

  async summerizer(payload: {
    jobId: string;
    productAnchors: any[];
    search: string;
    retryCount?: number;
    maxRetries?: number;
  }) {
    try {
      const descriptions = payload.productAnchors.map(
        (item) => item.description ?? '',
      );
      const keyword = payload.search;

      const summaryInputs = descriptions.map((desc) => ({
        desc,
        keyword,
      }));

      const summaryResults =
        await this.openAIService.getBatchSummaryAndRelevanceScores(
          summaryInputs,
        );

      payload.productAnchors.forEach((item, idx) => {
        item.summary = summaryResults[idx]?.summary ?? 'N/A';
        item.relevance_score = summaryResults[idx]?.relevance_score ?? 0;
        const discountedPriceNum = parseFloat(
          (item.discountedPrice || '').replace(/[^0-9.]/g, ''),
        );
        item.value_score =
          discountedPriceNum && !isNaN(discountedPriceNum)
            ? item.relevance_score / discountedPriceNum
            : 0;

        const originalPriceNum = parseFloat(
          (item.originalPrice || '').replace(/[^0-9.]/g, ''),
        );
        item.discount_amount =
          !isNaN(originalPriceNum) && !isNaN(discountedPriceNum)
            ? originalPriceNum - discountedPriceNum
            : 0;
        item.discount_percent =
          Number(item.discount_amount / originalPriceNum) * 100;
      });

      // Batch save productAnchors to the Process table
      if (payload.productAnchors && payload.productAnchors.length > 0) {
        // Prepare SmartBook entities from productAnchors
        const smartBookEntities = payload.productAnchors.map((item) =>
          this.smartBookRepository.create({
            href: item.href,
            image: item.image,
            title: item.title,
            originalPrice: item.originalPrice,
            discountedPrice: item.discountedPrice,
            author: item.author,
            jobId: item.jobId,
            search: item.search,
            description: item.description,
            summary: item.summary,
            relevance_score: item.relevance_score,
            value_score: item.value_score,
            discount_amount: item.discount_amount,
            discount_percent: item.discount_percent,
          }),
        );
        // Bulk save to SmartBook entity
        await this.smartBookRepository.save(smartBookEntities);

        // Update Process status to 'completed'
        await this.processRepository.update(
          { job_id: payload.jobId },
          {
            status: 'completed',
            processed_data: payload.productAnchors.length,
          },
        );
      }

      await this.rabitmqService.publishMessage(
        payload.productAnchors.map((item) => ({
          worker: 'webhook',
          message: {
            action: 'finalize',
            type: 'page',
            data: {
              item,
            },
          },
        })),
      );
    } catch (error) {
      // Check for max retry and update process status to 'failed'
      if (
        typeof payload.retryCount === 'number' &&
        typeof payload.maxRetries === 'number' &&
        payload.retryCount >= payload.maxRetries
      ) {
        await this.processRepository.update(
          { job_id: payload.jobId },
          { status: 'failed' },
        );
      }
      throw error;
    }
  }

  async webhook(payload: { item: any }) {
    try {
      const webhookUrl = this.configService.get<string>('MAKE_WEBHOOK_URL');
      if (!webhookUrl) {
        throw new BadRequestException(
          'MAKE_WEBHOOK_URL is not defined in the environment variables',
        );
      }
      await this.httpRequestService.request.post(webhookUrl, payload.item);
    } catch (error) {
      throw error;
    }
  }

  async getProcessByJobId(jobId: string): Promise<Process | null> {
    console.log('Fetching Process by jobId:', jobId);
    if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
      throw new BadRequestException('Invalid jobId provided');
    }
    try {
      const process = await this.processRepository.findOne({
        where: { job_id: jobId },
      });
      if (!process) {
        throw new NotFoundException(`Process with jobId ${jobId} not found`);
      }
      return process;
    } catch (error) {
      console.error(`Error fetching process by jobId: ${jobId}`, error);
      throw new Error('Failed to fetch process by jobId');
    }
  }

  async getSmartBooksByJobId(jobId: string): Promise<SmartBook[]> {
    if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
      throw new Error('Invalid jobId provided');
    }
    try {
      const smartBooks = await this.smartBookRepository.find({
        where: { jobId },
        order: { relevance_score: 'DESC' },
      });
      if (!smartBooks || smartBooks.length === 0) {
        throw new NotFoundException(`No SmartBooks found for jobId ${jobId}`);
      }
      return smartBooks;
    } catch (error) {
      console.error(`Error fetching SmartBooks by jobId: ${jobId}`, error);
      throw new Error('Failed to fetch SmartBooks by jobId');
    }
  }
}
