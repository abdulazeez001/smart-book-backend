export interface IInitializeScrape {
  job_id: string;
  search: string;
  processed_data: number;
  total_expected_data: number;
  rawScrapedData: Array<{
    href: string;
    image: string;
    title: string;
    originalPrice: string | number;
    discountedPrice: string | number;
    sku: string;
    isbn10: string | null;
    isbn13: string | null;
    publisher: string | null;
    publicationDate: string | null;
    printLength: string | null;
    language: string | null;
    dimensions: string | null;
  }>;
  status: 'processing' | 'success' | 'failed';
}
