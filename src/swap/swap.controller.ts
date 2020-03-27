import { Controller, Injectable, Get, Query } from '@nestjs/common';
import { EthTransfer } from 'src/exchange/ethtransfer.entity';
import { SwapService } from './swap.service';

@Injectable()
@Controller('exchange')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Get('transactions')
  async getTransactionList(
    @Query('address') address: string,
  ): Promise<EthTransfer[]> {
    return await this.swapService.getUserTransfers(address);
  }

  @Get('config')
  async getConfig(): Promise<any> {
    return await this.swapService.getConfig();
  }

  @Get('tokenRate')
  async getTokenRate(): Promise<any> {
    return await this.swapService.exchangeRate();
  }
}
