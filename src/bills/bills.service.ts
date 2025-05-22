import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bill } from './entities/bill.entity';
import { SmartBook } from 'src/common/entities/smart_book.entity';
import { IInitializeScrape } from './interfaces/bill.interfaces';
// import { GetOperatorsDto } from './dto/get-operators.dto';
import { Page } from 'puppeteer';
import { RabbitmqService } from 'src/rabbitmq/rabbitmq.service';
import browserPagePool from 'src/common/libs/browserManager';
import { OpenaiService } from 'src/openai/openai.service';
import { HttpRequest } from 'src/http-request/http-request.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(Bill)
    private readonly billRepository: Repository<Bill>,
    @InjectRepository(SmartBook)
    private readonly smartBookRepository: Repository<SmartBook>,

    private readonly configService: ConfigService,
    private readonly httpRequestService: HttpRequest,
    private readonly rabitmqService: RabbitmqService,
    private readonly openAIService: OpenaiService,
  ) {}

  async initiateScrape(search: string): Promise<IInitializeScrape> {
    const browserPage = await browserPagePool.acquire();
    const page = browserPage.page as Page;
    try {
      // Generate a unique job ID containing the search term and ensure it doesn't exist in the DB
      let jobId: string;
      do {
        const randomStr = Math.random().toString(36).substring(2, 8);
        jobId = `job_${search}_${randomStr}`;
      } while (
        await this.billRepository.findOne({
          where: { job_id: jobId },
          select: ['job_id'],
        })
      );

      page.waitForNavigation();
      page.waitForSelector('.site-content');
      interface ProductInfo {
        href: string | null;
        image: string | null;
        title: string | null;
        originalPrice: string | null;
        discountedPrice: string | null;
        sku: string | null;
        isbn10: string | null;
        isbn13: string | null;
        publisher: string | null;
        publicationDate: string | null;
        printLength: string | null;
        language: string | null;
        dimensions: string | null;
      }

      const productAnchors: ProductInfo[] = [];

      for (let pageNum = 1; pageNum <= 2; pageNum++) {
        const url =
          pageNum === 1
            ? `https://bookdp.com.au/?s=${encodeURIComponent(search.toLowerCase())}&post_type=product`
            : `https://bookdp.com.au/page/${pageNum}/?s=${encodeURIComponent(search.toLowerCase())}&post_type=product`;

        await page.goto(url);
        await page.waitForSelector('li.product a', { timeout: 5000 });

        const productsOnPage = await page.$$eval('li.product', (items) => {
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
            tableRows.forEach((tr) => {
              const th = tr.querySelector('th');
              const td = tr.querySelector('td');
              if (th && td) {
                details[th.textContent!.replace(':', '').trim().toLowerCase()] =
                  td.textContent?.trim() || '';
              }
            });

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
              sku: getText('.meta-sku span'),
              isbn10: details['isbn-10'] || null,
              isbn13: details['isbn-13'] || null,
              publisher: details['publisher'] || null,
              publicationDate: details['publication date'] || null,
              printLength: details['print length'] || null,
              language: details['language'] || null,
              dimensions: details['dimensions'] || null,
            };
          });
        });

        productAnchors.push(...productsOnPage);
      }

      const response = await this.billRepository.save({
        job_id: jobId,
        search,
        processed_data: 0,
        total_expected_data: productAnchors.length,
        status: 'processing',
      });
      await browserPagePool.release(browserPage);

      await this.rabitmqService.publishMessage([
        {
          worker: 'scraper',
          message: {
            action: 'scrape',
            type: 'page',
            data: {
              jobId,
              productAnchors,
              search,
            },
          },
        },
      ]);
      return {
        ...response,
        rawScrapedData: productAnchors,
      } as IInitializeScrape;
    } catch (error) {
      await browserPagePool.destroy(browserPage);
      console.error('Error during scraping:', error);
      throw new Error('Failed to initiate scraping');
    }
  }

  async scrapeData(payload: {
    jobId: string;
    productAnchors: any[];
    search: string;
  }) {
    // Extract all image URLs from the productAnchors
    const coverImgUrls = payload.productAnchors
      .map((item) => item.image ?? '')
      .filter(Boolean);

    // Get authors for each image URL
    const authorsMap =
      await this.openAIService.getBatchAuthorsFromCoverImages(coverImgUrls);

    console.log('Authors Map:', authorsMap);

    // Update each productAnchor with the author field
    for (const item of payload.productAnchors) {
      const authors = authorsMap.get(item.image ?? '') ?? ['N/A'];
      item.author = authors;
      item.jobId = payload.jobId;
      item.search = payload.search;
    }

    // Scrape each product page for more accurate and robust extraction
    for (const item of payload.productAnchors) {
      if (!item.href) continue;

      const productPage = await browserPagePool.acquire();
      const page = productPage.page as Page;

      try {
        await page.goto(item.href, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await page.waitForSelector('.site-content', { timeout: 5000 });

        // Category
        item.category = await page
          .$eval('.meta.meta-cat a', (el) => el.textContent?.trim() || null)
          .catch(() => null);

        // Title
        item.title = await page
          .$eval(
            'h1.product_title.entry-title',
            (el) => el.textContent?.trim() || null,
          )
          .catch(() => item.title);

        // Price
        item.price = await page
          .$eval(
            '.motta-price-stock .price ins .amount bdi',
            (el) => el.textContent?.trim() || null,
          )
          .catch(
            async () =>
              await page
                .$eval(
                  '.motta-price-stock .price .amount bdi',
                  (el) => el.textContent?.trim() || null,
                )
                .catch(() => null),
          );
        item.originalPrice = await page
          .$eval(
            '.motta-price-stock .price del .amount bdi',
            (el) => el.textContent?.trim() || null,
          )
          .catch(() => null);

        // Stock
        item.stock = await page
          .$eval(
            '.motta-price-stock .stock',
            (el) => el.textContent?.trim() || null,
          )
          .catch(() => null);

        // Features Table
        const features = await page.$$eval(
          '.short-description__content table tr',
          (rows) => {
            const obj: Record<string, string> = {};
            rows.forEach((tr) => {
              const th = tr.querySelector('th');
              const td = tr.querySelector('td');
              if (th && td) {
                obj[
                  th
                    .textContent!.replace(':', '')
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, '')
                ] = td.textContent?.trim() || '';
              }
            });
            return obj;
          },
        );
        Object.assign(item, features);

        // SKU
        item.sku = await page
          .$eval('.product_meta .sku', (el) => el.textContent?.trim() || null)
          .catch(() => item.sku || null);

        // Tags
        item.tags = await page
          .$$eval('.product_meta .tagged_as a', (els) =>
            els.map((el) => el.textContent?.trim()).filter(Boolean),
          )
          .catch(() => []);

        // Description
        item.description = await page
          .$eval(
            '#tab-description .woocommerce-tabs--description-content',
            (el) => el.textContent?.trim() || null,
          )
          .catch(() => null);

        // Ratings
        item.rating = await page
          .$eval(
            '.motta-product-rating__average-value',
            (el) => el.textContent?.trim() || null,
          )
          .catch(() => null);
        item.ratingCount = await page
          .$eval(
            '.motta-product-rating__count',
            (el) => el.textContent?.trim() || null,
          )
          .catch(() => null);

        await browserPagePool.release(productPage);
      } catch (err) {
        await browserPagePool.destroy(productPage);
        console.error(
          `Failed to scrape details for ${item.href}:`,
          err.message,
        );
      }
    }

    const { jobId, search } = payload;

    await this.rabitmqService.publishMessage([
      {
        worker: 'summary',
        message: {
          action: 'summarize',
          type: 'page',
          data: {
            jobId,
            productAnchors: payload.productAnchors,
            search,
          },
        },
      },
    ]);
  }

  async getBillByJobId(jobId: string): Promise<Bill | null> {
    console.log('Fetching bill by jobId:', jobId);
    if (!jobId || typeof jobId !== 'string' || !jobId.trim()) {
      throw new BadRequestException('Invalid jobId provided');
    }
    try {
      const bill = await this.billRepository.findOne({
        where: { job_id: jobId },
      });
      if (!bill) {
        throw new NotFoundException(`Bill with jobId ${jobId} not found`);
      }
      return bill;
    } catch (error) {
      console.error(`Error fetching bill by jobId: ${jobId}`, error);
      throw new Error('Failed to fetch bill by jobId');
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

  async summerizer(payload: {
    jobId: string;
    productAnchors: any[];
    search: string;
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
        item.discount_percent = Number(item.discount_amount / originalPriceNum);
      });

      console.log('Updated Product Anchors:', payload.productAnchors);

      // Batch save productAnchors to the Bill table
      if (payload.productAnchors && payload.productAnchors.length > 0) {
        // Prepare SmartBook entities from productAnchors
        const smartBookEntities = payload.productAnchors.map((item) =>
          this.smartBookRepository.create({
            href: item.href,
            image: item.image,
            title: item.title,
            originalPrice: item.originalPrice,
            discountedPrice: item.discountedPrice,
            sku: item.sku,
            isbn10: item.isbn10 || item['isbn-10'],
            isbn13: item.isbn13 || item['isbn-13'],
            publisher: item.publisher,
            publicationDate: item.publicationDate || item.publicationdate,
            printLength: item.printLength || item.printlength,
            language: item.language,
            dimensions: item.dimensions,
            author: item.author,
            jobId: item.jobId,
            search: item.search,
            category: item.category,
            price: item.price,
            stock: item.stock,
            tags: item.tags,
            description: item.description,
            rating: item.rating,
            ratingCount: item.ratingCount,
            summary: item.summary,
            relevance_score: item.relevance_score,
            value_score: item.value_score,
            discount_amount: item.discount_amount,
            discount_percent: item.discount_percent,
          }),
        );
        // Bulk save to SmartBook entity
        await this.smartBookRepository.save(smartBookEntities);

        // Update Bill status to 'completed'
        await this.billRepository.update(
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
      console.log('Updated Product Anchors:', payload.item);
    } catch (error) {
      throw error;
    }
  }
}
