import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import {
  PaginationResultInterface,
  ErrorsInterface,
  IGenerateClientAssertionPayload,
} from '../utils/interfaces';
import { ValidationError } from '@nestjs/common';
import { sign } from 'jsonwebtoken';
import axios from 'axios';

export const paginateResult = (
  total_count: number,
  current_page: number,
  limit: number,
): PaginationResultInterface => {
  const has_next_page = total_count > Number(current_page) * limit;
  const has_prev_page = Number(current_page) > 1;
  const total_pages = Math.ceil(total_count / limit);
  const out_of_range = current_page > total_pages;

  return {
    count: !out_of_range
      ? Math.min(limit, total_count - (current_page - 1) * limit)
      : 0,
    total_count,
    current_page: Number(current_page),
    prev_page: has_prev_page ? Number(current_page) - 1 : null,
    next_page: has_next_page ? Number(current_page) + 1 : null,
    total_pages,
    out_of_range,
  };
};

export const formatValidationError = (error: ValidationError) => {
  const formatted = [];

  if (error.constraints) {
    formatted.push({
      field: error.property,
      errors: Object.values(error.constraints),
    });
  }

  if (error.children && error.children.length > 0) {
    error.children.forEach((childError) => {
      formatted.push(...formatValidationError(childError));
    });
  }

  return formatted;
};

export const formatErrorMessages = (
  errors: ErrorsInterface,
  message: string,
): string[] => {
  let $errors: string[] = [];

  if (Array.isArray(errors) && errors.length === 0) {
    $errors.push(message);
    return $errors;
  }

  if (!Array.isArray(errors.message)) {
    $errors.push(errors.message);
    return $errors;
  }

  errors.message.forEach((e) => {
    console.log({ e });
    $errors = e.errors;
  });

  return $errors;
};

export const generateRandomString = (length: number): string => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charactersLength);
    result += characters[randomIndex];
  }
  return result;
};

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const sanitizeString = (input: string): string => {
  return input.replace(/[^0-9]/g, '');
};

export const writeBufferToFile = async (
  buffer: Buffer,
  filename: string,
  directory: string,
): Promise<string> => {
  const writeFileAsync = promisify(fs.writeFile);
  // Ensure the directory exists
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  // Generate full file path
  const filePath = path.join(directory, filename);

  try {
    // Write the buffer to the file
    await writeFileAsync(filePath, buffer);
    return filePath; // Return the path of the saved file
  } catch (error) {
    throw new Error(`Failed to write buffer to file: ${error.message}`);
  }
};

export const generateClientAssertion = (
  payload: IGenerateClientAssertionPayload,
): string => {
  const { private_key, iss, client_id, base_url } = payload;
  const client_assertion_payload = {
    iss,
    sub: client_id,
    aud: base_url,
  };
  const client_assertion: string = sign(client_assertion_payload, private_key, {
    algorithm: 'RS256',
    expiresIn: 600, // 10 minutes in seconds
  });
  return client_assertion;
};

export const generateUniqueId = (): string => {
  const uuid = uuidv4();
  return uuid;
};

export const convertImageToBase64 = async (
  url: string,
  cookies?: string,
): Promise<string | null> => {
  if (!url) {
    return null;
  }
  const response = await axios.get(url, {
    headers: cookies ? { Cookie: cookies } : {},
    responseType: 'arraybuffer',
  });
  const buffer = Buffer.from(response.data);
  const base64Image = `data:${response.headers['content-type']};base64,${buffer.toString('base64')}`;

  return base64Image;
};

export const sha1 = (data: string): string => {
  return data;
};
