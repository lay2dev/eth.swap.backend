import { Injectable, Inject } from '@nestjs/common';
import {
  ETHTRANSFER_REPOSITORY,
  PENDINGSWAP_REPOSITORY,
  SWAP_STATUS,
} from 'src/util/constant';
import { EthTransfer } from 'src/exchange/ethtransfer.entity';
import { LoggerService } from 'nest-logger';
import { ConfigService } from 'src/config/config.service';
import { RedisService } from 'nestjs-redis';
import * as web3Utils from 'web3-utils';

@Injectable()
export class SwapService {
  private depositEthAddress: string;

  constructor(
    @Inject(ETHTRANSFER_REPOSITORY)
    private readonly ethTransferModel: typeof EthTransfer,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.depositEthAddress = this.config.get('ETH_DEPOSIT_ADDRESS');
  }

  async getUserTransfers(ethAddress: string): Promise<any[]> {
    // check address format
    if (!web3Utils.isAddress(ethAddress)) {
      return [];
    }

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
    const { toBN } = web3Utils;
    const tokenList = this.config.tokenList;

    const tokenRateList = [];
    for (const token of tokenList) {
      const { symbol } = token;
      const price = await this.redisService.getClient().get(`${symbol}_price`);
      tokenRateList.push({ symbol, price });
    }
    const ckbPrice = await this.redisService.getClient().get(`CKB_price`);

    const pricePlusRate =
      toBN(Math.floor(Number(ckbPrice) * 10 ** 8))
        .mul(toBN(10 ** 6))
        .div(toBN(Math.floor((1 - this.config.SWAP_FEE_RATE) * 10 ** 8)))
        .toNumber() /
      10 ** 6;

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

    if (txhash.length !== 66 || tokenSymbolList.indexOf(tokenSymbol) < 0) {
      return false;
    }

    let ethTransfer = await this.ethTransferModel.findOne({
      where: { txhash },
    });

    if (ethTransfer) {
      if (ethTransfer.status !== SWAP_STATUS.CONFIRMING) {
        return false;
      }
    } else {
      ethTransfer = new EthTransfer();
      ethTransfer.txhash = txhash;
      ethTransfer.status = SWAP_STATUS.CONFIRMING;
    }

    ethTransfer.ckbAmount = Number(ckbAmount) * 10 ** 8;
    ethTransfer.currency = tokenSymbol;
    ethTransfer.amount = tokenAmount;
    ethTransfer.from = from;

    await ethTransfer.save();

    return true;
  }
}
