import { Injectable, Inject } from '@nestjs/common';
import { NestSchedule, Interval } from 'nest-schedule';
import { EthTransfer } from './ethtransfer.entity';
import { ETHTRANSFER_REPOSITORY } from '../util/constant';
import { LoggerService } from 'nest-logger';
import { ConfigService } from 'src/config/config.service';
import { huobipro } from 'ccxt';
import { RedisService } from 'nestjs-redis';

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
}
