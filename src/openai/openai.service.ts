import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
// import env from '../config/env';
import { ConfigService } from '@nestjs/config';
import { convertImageToBase64 } from 'src/common/helpers';
import { BookSummaryAnalysis } from './openai.interfaces';

@Injectable()
export class OpenaiService {
  private openai: OpenAI;
  private readonly environment: string;
  private readonly OpenAIClient: OpenAI;
  constructor(private readonly configService: ConfigService) {
    this.environment = this.configService.get<string>('NODE_ENV')!;
    this.OpenAIClient = new OpenAI({
      apiKey: this.configService.get<string>('OPEN_AI_API_KEY'),
    });
  }

  async getBatchAuthorsFromCoverImages(
    coverImgUrls: string[],
  ): Promise<Map<string, string[]>> {
    const base64Images = await Promise.all(
      coverImgUrls.map(async (url) => await convertImageToBase64(url)),
    );

    const prompt =
      `You are an intelligent image analyzer that extracts author names from book cover images. ` +
      `You will be provided with multiple base64-encoded book cover images. ` +
      `For each image, return a JSON object where the keys are the 0-based indices of the images, and the values are arrays of author name strings. ` +
      `Each array should contain one or more author names extracted from the corresponding book cover. ` +
      `If the author(s) cannot be confidently identified, use ["N/A"] for that entry. ` +
      `Example response: { "0": ["J.K. Rowling"], "1": ["Author One", "Author Two"], "2": ["N/A"] }.` +
      `Do not include any explanation, markdown or text outside the JSON object.`;

    const imageMessages = base64Images.map((base64Image: string) => ({
      type: 'image_url' as const,
      image_url: { url: base64Image },
    }));

    const response = await this.OpenAIClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...imageMessages],
        },
      ],
    });

    const content = response.choices[0].message.content?.trim();
    const resultMap = new Map<string, string[]>();

    try {
      const authorsObj = JSON.parse(content || '{}');

      coverImgUrls.forEach((url, index) => {
        const authors = Array.isArray(authorsObj[index])
          ? authorsObj[index].map((a: any) =>
              typeof a === 'string' ? a : 'N/A',
            )
          : ['N/A'];
        resultMap.set(url, authors);
      });
    } catch (error) {
      console.error('[OpenAI Error] Failed to parse authors JSON response.', {
        error,
        rawResponse: content,
      });
      // fallback: assign ["N/A"] to each url
      coverImgUrls.forEach((url) => resultMap.set(url, ['N/A']));
    }

    return resultMap;
  }

  async getBatchSummaryAndRelevanceScores(
    inputs: { desc: string; keyword: string }[],
  ): Promise<BookSummaryAnalysis[]> {
    const prompt =
      `You are a helpful assistant that analyzes multiple book descriptions.\n` +
      `For each input, do the following:\n` +
      `1. Generate a 1–2 sentence summary.\n` +
      `2. Rate how relevant the description is to the keyword (0–100).\n\n` +
      `Return ONLY a valid JSON array of objects in the same order, with the format:\n` +
      `[{"summary": string, "relevance_score": number}]\n` +
      `Do not include any explanation, markdown, or text outside the JSON array. Do NOT wrap the output in \`\`\` or any other formatting. The output must be directly parsable by JSON.parse.`;

    const formattedInput = inputs
      .map(
        ({ desc, keyword }, i) =>
          `Input ${i + 1}:\nDescription: ${desc}\nKeyword: "${keyword}"`,
      )
      .join('\n\n');

    const response = await this.OpenAIClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: formattedInput },
      ],
      temperature: 0.5,
      max_tokens: 1500,
    });

    const rawContent = response.choices[0].message.content?.trim() || '';

    try {
      const parsed: any[] = JSON.parse(rawContent);

      return parsed.map((item) => ({
        summary: typeof item.summary === 'string' ? item.summary : 'N/A',
        relevance_score:
          typeof item.relevance_score === 'number'
            ? Math.max(0, Math.min(100, item.relevance_score))
            : 0,
      }));
    } catch (error) {
      console.error('[OpenAI Error] Failed to parse batch JSON response.', {
        error,
        rawResponse: rawContent,
      });

      return inputs.map(() => ({
        summary: 'N/A',
        relevance_score: 0,
      }));
    }
  }
}
