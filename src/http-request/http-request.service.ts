// http-request.service.ts

import { Injectable } from '@nestjs/common';
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosError,
  AxiosResponse,
} from 'axios';

interface HttpRequestOptions {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export class HttpError extends Error {
  public status: number;
  public statusText: string;
  public headers: any;
  public config: AxiosRequestConfig;
  public data: any;

  constructor(axiosErrorResponse: AxiosResponse) {
    super(axiosErrorResponse?.data?.message || 'Something happened');

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }

    this.name = 'HttpError';
    this.status = axiosErrorResponse.status;
    this.statusText = axiosErrorResponse.statusText;
    this.headers = axiosErrorResponse.headers;
    this.config = axiosErrorResponse.config;
    this.data = axiosErrorResponse.data;
  }
}

@Injectable()
export class HttpRequest {
  private readonly axios = axios;
  private requestOptions: AxiosRequestConfig = {
    timeout: 300000,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  /**
   * Call this to set initial options
   */
  configure(options: HttpRequestOptions): this {
    this.requestOptions = {
      baseURL: options.baseURL,
      timeout: options.timeout || 300000,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    };
    return this;
  }

  /**
   * Injects tracing headers from a span.
   */
  setSpan(span: any): this {
    if (span) {
      const headers: Record<string, string> = {};
      this.requestOptions.headers = {
        ...this.requestOptions.headers,
        ...headers,
      };
    }
    return this;
  }

  /**
   * Adds custom headers to the request.
   */
  addHeaders(headers: Record<string, string>): this {
    if (headers && typeof headers === 'object') {
      this.requestOptions.headers = {
        ...this.requestOptions.headers,
        ...headers,
      };
    }
    return this;
  }

  /**
   * Returns an Axios instance with configured interceptors.
   */
  get request(): AxiosInstance {
    const instance = this.axios.create(this.requestOptions);

    instance.interceptors.request.use(
      (config) => config,
      (error: AxiosError) => {
        return Promise.reject(new HttpError(error.response!));
      },
    );

    instance.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError) => {
        return Promise.reject(new HttpError(error.response!));
      },
    );

    return instance;
  }

  /**
   * Returns the Axios CancelToken class.
   */
  getCancelToken() {
    return this.axios.CancelToken;
  }
}
