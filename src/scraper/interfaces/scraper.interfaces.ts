export interface IInitializeScrape {
  job_id: string;
  search: string;
  processed_data: number;
  total_expected_data: number;
  // rawScrapedData: Array<{
  //   href: string;
  //   image: string;
  //   title: string;
  //   originalPrice: string | number;
  //   discountedPrice: string | number;
  //   // sku: string;
  //   // isbn10: string | null;
  //   // isbn13: string | null;
  //   publisher: string | null;
  //   // publicationDate: string | null;
  //   // printLength: string | null;
  //   // language: string | null;
  //   // dimensions: string | null;
  // }>;
  status: 'processing' | 'success' | 'failed';
}

export interface ProductInfo {
  href: string | null;
  image: string | null;
  title: string | null;
  originalPrice: string | null;
  discountedPrice: string | null;
  // sku: string | null;
  // isbn10: string | null;
  // isbn13: string | null;
  publisher: string | null;
  // publicationDate: string | null;
  // printLength: string | null;
  // language: string | null;
  // dimensions: string | null;

  author?: string[] | null;
  jobId?: string | null;
  search?: string | null;
  description?: string | null;
}
