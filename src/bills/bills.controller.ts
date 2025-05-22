import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody } from '@nestjs/swagger';
import { BillsService } from './bills.service';

@ApiTags('Bills')
@Controller('/v1')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @ApiOperation({ summary: 'Initiate Scrape' })
  @ApiBody({
    description: 'Search term for scraping',
    type: String,
  })
  @ApiParam({ name: 'search', description: 'Search term' })
  @Post('/scrape')
  @HttpCode(HttpStatus.OK)
  async initiateScrape(@Body('search') search: string) {
    const response = await this.billsService.initiateScrape(search);
    return {
      response: response,
      message: 'Scrape initiated successfully!',
    };
  }

  @ApiOperation({ summary: 'Get Job status by Job ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID of the Process' })
  @Get('/status/:jobId')
  @HttpCode(HttpStatus.OK)
  async getBillByJobId(@Param('jobId') jobId: string) {
    const response = await this.billsService.getBillByJobId(jobId);
    return {
      response,
      message: 'Bill retrieved successfully!',
    };
  }

  @ApiOperation({ summary: 'Get SmartBooks by Job ID' })
  @ApiParam({ name: 'jobId', description: 'Job ID for SmartBooks' })
  @Get('/results/:jobId')
  @HttpCode(HttpStatus.OK)
  async getSmartBooksByJobId(@Param('jobId') jobId: string) {
    const response = await this.billsService.getSmartBooksByJobId(jobId);
    return {
      response,
      message: 'SmartBooks retrieved successfully!',
    };
  }
}
