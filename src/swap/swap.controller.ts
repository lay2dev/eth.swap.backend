import { Controller, Injectable, Get, Query, Post, Param, Req } from '@nestjs/common';
import { EthTransfer } from 'src/exchange/ethtransfer.entity';
import { SwapService } from './swap.service';
import { Request } from 'express';

@Injectable()
@Controller('exchange')
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Get('transactions')
  async getTransactionList(@Query('address') address: string): Promise<EthTransfer[]> {
    return await this.swapService.getUserTransfers(address);
  }

  @Get('config')
  async getConfig(): Promise<any> {
    return await this.swapService.getConfig();
  }

  @Get('latestBlock')
  async getLatestBlock(): Promise<any> {
    return await this.swapService.getLatestBlock();
  }

  @Get('tokenRate')
  async getTokenRate(): Promise<any> {
    return await this.swapService.exchangeRate();
  }

  @Post('submitPendingSwap')
  async submitPendingSwap(@Req() request: Request): Promise<any> {
    const { txhash, ckbAmount, tokenSymbol, tokenAmount, from } = request.body;

    const result = await this.swapService.submitPendingSwap(txhash, ckbAmount, tokenSymbol, tokenAmount, from);

    if (result) {
      return {
        code: 0,
        msg: 'success',
      };
    } else {
      return {
        code: 500,
        msg: 'error',
      };
    }
  }
}
