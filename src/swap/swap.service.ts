import { Injectable, Inject } from '@nestjs/common';
import {
  ETHTRANSFER_REPOSITORY,
  PENDINGSWAP_REPOSITORY,
} from 'src/util/constant';
import { EthTransfer } from 'src/exchange/ethtransfer.entity';
import { LoggerService } from 'nest-logger';
import { ConfigService } from 'src/config/config.service';
import { RedisService } from 'nestjs-redis';
import { PendingSwap } from 'src/exchange/pendingswap.entity';

@Injectable()
export class SwapService {
  private depositEthAddress: string;

  constructor(
    @Inject(ETHTRANSFER_REPOSITORY)
    private readonly ethTransferModel: typeof EthTransfer,
    @Inject(PENDINGSWAP_REPOSITORY)
    private readonly pendingSwapModel: typeof PendingSwap,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.depositEthAddress = this.config.get('ETH_DEPOSIT_ADDRESS');
  }

  async getUserTransfers(ethAddress: string): Promise<any[]> {
    // check address format

    // fetch transfer from table order by id desc
    const transfers = await this.ethTransferModel.findAll({
      where: { from: ethAddress },
      order: [['id', 'desc']],
    });
    // return transfers;

    return transfers.map(item => {
      const decimal = this.config.tokenList.filter(
        t => t.symbol === item.currency,
      )[0].decimal;
      const {
        id,
        txhash,
        confirmations,
        currency,
        from,
        to,
        amount,
        ckbAmount,
        currencyPrice,
        ckbPrice,
        status,
        transferTime,
      } = item;

      return {
        id,
        txhash,
        confirmations,
        currency,
        decimal,
        from,
        to,
        amount,
        ckbAmount,
        currencyPrice,
        ckbPrice,
        status,
        transferTime,
      };
    });
  }

  async getConfig() {
    const tokenList = this.config.tokenList;
    const chain = this.config.get('ETH_CHAIN');
    const feeRate = this.config.SWAP_FEE_RATE;
    const swapCKBAmountList = this.config.ckbAmountList;

    return {
      chain,
      feeRate,
      depositEthAddress: this.depositEthAddress,
      tokenList,
      swapCKBAmountList,
    };
  }

  async exchangeRate() {
    const tokenList = this.config.tokenList;

    const tokenRateList = [];
    for (const token of tokenList) {
      const { symbol } = token;
      const price = await this.redisService.getClient().get(`${symbol}_price`);
      tokenRateList.push({ symbol, price });
    }
    const ckbPrice = await this.redisService.getClient().get(`CKB_price`);

    const pricePlusRate =
      Math.floor(
        Number(ckbPrice) * 100000000 * (1 + this.config.SWAP_FEE_RATE),
      ) / 100000000;

    tokenRateList.push({
      symbol: 'CKB',
      price: pricePlusRate,
    });
    return tokenRateList;
  }

  async submitPendingSwap(
    txhash: string,
    ckbAmount: number,
    tokenSymbol: string,
    tokenAmount: number,
    from: string,
  ) {
    const tokenSymbolList = this.config.tokenList.map(item => item.symbol);

    //TODO: check pending swap;

    if (txhash.length !== 66 || tokenSymbolList.indexOf(tokenSymbol) < 0) {
      return false;
    }

    const pendingSwap = new PendingSwap();

    pendingSwap.txhash = txhash;
    pendingSwap.ckbAmount = ckbAmount;
    pendingSwap.currency = tokenSymbol;
    pendingSwap.amount = tokenAmount;
    pendingSwap.from = from;

    await pendingSwap.save();

    return true;
  }
}
