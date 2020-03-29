import { Injectable, Inject } from '@nestjs/common';
import { NestSchedule, Interval } from 'nest-schedule';
import { EthTransfer } from './ethtransfer.entity';
import { ETHTRANSFER_REPOSITORY, CKBConvertInfo } from '../util/constant';
import { LoggerService } from 'nest-logger';
import { ConfigService } from 'src/config/config.service';
import { huobipro } from 'ccxt';
import { RedisService } from 'nestjs-redis';
import * as web3Utils from 'web3-utils';

@Injectable()
export class ExchangeService extends NestSchedule {
  private huobiClient: huobipro;

  constructor(
    @Inject(ETHTRANSFER_REPOSITORY)
    private readonly ethTransferModel: typeof EthTransfer,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService, // private readonly ckbService: CkbService, // private readonly cellService: CellService,
  ) {
    super();
    this.huobiClient = new huobipro();
  }

  @Interval(5 * 1000)
  async getAssetPrice() {
    const ckbTicker = await this.huobiClient.fetchTicker('CKB/USDT');
    this.logger.info(`CKB_price  = ${ckbTicker.ask}`);
    await this.redisService.getClient().set('CKB_price', ckbTicker.ask);

    for (const token of this.config.tokenList) {
      if (token.symbol === 'USDT') {
        await this.redisService.getClient().set(`${token.symbol}_price`, 1);
      } else {
        const ticker = await this.huobiClient.fetchTicker(
          `${token.symbol}/USDT`,
        );
        this.logger.info(`${token.symbol}_price  = ${ticker.bid}`);
        await this.redisService
          .getClient()
          .set(`${token.symbol}_price`, ticker.bid);
      }
    }
  }

  async sellAsset() {
    // this.huobiClient.
    // this.huobiClient.createLimitOrder('ETH/USDT', 'sell', 1);
    const order = await this.huobiClient.createMarketOrder(
      'ETH/USDT',
      'sell',
      1,
    );
  }

  async buyAsset() {
    const order = this.huobiClient.createMarketOrder('CKB/USDT', 'buy', 1001);
    // this.huobiClient.createLimitOrder('CKB/USDT', 'buy', 1001);
  }

  /**
   * SIMPLE TRANSFER STRATEGY.
   * TODO: will be subsititued by exchange API.
   * calculate the corresponding ckb amount for received token at current price from exchanges
   * @param tokenName
   * @param amount
   */
  async ConvertAsset(
    tokenName: string,
    amount: number,
  ): Promise<CKBConvertInfo> {
    const tokenPrice = Number(
      await this.redisService
        .getClient()
        .get(`${tokenName.toUpperCase()}_price`),
    );
    const ckbPrice = Number(
      await this.redisService.getClient().get('CKB_price'),
    );
    this.logger.info(
      `tokenName = [${tokenName}] amount= [${amount}] tokenPrice = [${tokenPrice}] ckbPrice = [${ckbPrice}]`,
    );

    const tokenDecimal = this.config.tokenList.filter(
      item => item.symbol === tokenName,
    )[0].decimal;

    const { toBN } = web3Utils;
    const tokenPriceBN = toBN(Math.floor(Number(tokenPrice) * 10 ** 8));
    const ckbPriceBN = toBN(Math.floor(Number(ckbPrice) * 10 ** 8));
    const ckbDecimal = 8;

    const feeRateBN = toBN(this.config.SWAP_FEE_RATE * 10000);
    const feeRateBaseBN = toBN(10000);

    const feeBN = toBN(amount)
      .mul(feeRateBN)
      .div(feeRateBaseBN);

    const ckbAmount = Number(
      toBN(amount)
        .sub(feeBN)
        .mul(tokenPriceBN)
        .div(ckbPriceBN)
        .mul(toBN(10 ** ckbDecimal))
        .div(toBN(10 ** tokenDecimal))
        .toString(10),
    );

    const swapFeeAmount = Number(feeBN.toString(10));

    return {
      tokenSymbol: tokenName,
      tokenPrice,
      tokenAmount: amount,
      ckbPrice,
      ckbAmount,
      swapFeeAmount,
      exchangeFee: 0,
    };
  }
}
