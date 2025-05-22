export interface ResponseMessageInterface {
  status_code: number;
  message: Array<string>;
  data: object;
}

export interface QueueTopologyInterface {
  queue: string;
  exchange: string;
  routing_key: string;
}

export interface MessageInterface {
  action: string;
  type: string;
  data: object;
}

export interface MessagePublisherInterface {
  worker: string;
  message: MessageInterface;
}

export interface FindManyInterface {
  docs: Array<object>;
  pagination: PaginationResultInterface;
}

export interface ErrorMessagesInterface {
  field: string;
  errors: Array<string>;
}

export interface ErrorsInterface {
  message: Array<ErrorMessagesInterface>;
}

export interface PaginationResultInterface {
  count: number;
  total_count: number;
  prev_page: number | null;
  current_page: number;
  next_page: number | null;
  total_pages: number;
  out_of_range: boolean;
}

export interface ResponseInterface {
  response?: {
    pagination?: PaginationResultInterface;
    docs?: Array<object>;
  };
  message?: string;
}

export interface IGenerateClientAssertionPayload {
  base_url: string;
  client_id: string;
  private_key: string;
  iss: string;
}
