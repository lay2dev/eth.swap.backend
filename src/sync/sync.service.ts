import { Injectable, Inject } from '@nestjs/common';
import { NestSchedule, Interval } from 'nest-schedule';
import { EthTransfer } from '../exchange/ethtransfer.entity';
import { ETHTRANSFER_REPOSITORY, SWAP_STATUS } from '../util/constant';
import { LoggerService } from 'nest-logger';
import { ConfigService } from 'src/config/config.service';
import {
  init,
  EtherscanApi,
  Response,
  ProxyResponse,
  Transaction,
  TokenTransaction,
} from 'etherscan-api';
import { RedisService } from 'nestjs-redis';
import * as web3Utils from 'web3-utils';

@Injectable()
export class SyncService extends NestSchedule {
  private depositEthAddress: string;
  private etherscanApi: EtherscanApi;

  constructor(
    @Inject(ETHTRANSFER_REPOSITORY)
    private readonly ethTransferModel: typeof EthTransfer,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService, // private readonly ckbService: CkbService, // private readonly cellService: CellService,
  ) {
    super();
    this.etherscanApi = init(
      this.config.get('ETHERSCAN_TOKEN'),
      this.config.get('ETH_CHAIN'),
    );
    this.depositEthAddress = this.config.get('ETH_DEPOSIT_ADDRESS');
    this.syncEthTransfers();
  }

  /**
   * fetch result from etherscan api response
   * @param response
   */
  getResultFromEtherscanApiResponse<T>(response: Response<T>): T {
    return response.result;
  }

  /**
   * fetch result from etherscan api proxy response
   * @param response
   */
  getResultFromEtherscanApiProxyResponse<T>(response: ProxyResponse<T>): T {
    return response.result;
  }

  /**
   * request recent txs from etherscanapi every 5 seconds, and process these txs.
   */
  @Interval(15 * 1000)
  async syncEthTransfers() {
    // get eth latest block number
    const latestBlockNumber = Number(
      this.getResultFromEtherscanApiProxyResponse(
        await this.etherscanApi.proxy.eth_blockNumber(),
      ),
    );
    const lastProcessedBlockNumber = Number(
      (await this.ethTransferModel.max('block', { where: { status: 2 } })) || 0,
    );
    this.logger.info(
      `startBlock=[${lastProcessedBlockNumber}], endBlock=[${latestBlockNumber}] `,
      SyncService.name,
    );

    await this.processRecentTxs(
      lastProcessedBlockNumber + 1,
      latestBlockNumber,
    );

    const erc20TokenList = this.config.tokenList.filter(
      v => v.symbol !== 'ETH',
    );
    for (const token of erc20TokenList) {
      await this.processRecentTokenTxs(
        token.symbol,
        token.address,
        lastProcessedBlockNumber,
        latestBlockNumber,
      );
    }
    this.logger.info(`syncEthTransfer job finished!`, SyncService.name);
  }

  /**
   * get recent ethereum transactions, save tx to db
   * @param startBlock
   * @param endBlock
   */
  async processRecentTxs(startBlock: number, endBlock: number) {
    let txs = [];
    try {
      txs = this.getResultFromEtherscanApiResponse(
        await this.etherscanApi.account.txlist(
          this.depositEthAddress,
          startBlock,
          endBlock,
        ),
      );
    } catch (err) {
      if (err === 'No transactions found') {
        this.logger.info(`ETH fetch txs size == 0`, SyncService.name);
      } else {
        this.logger.error(`ETH fetch txs failed: ${err}`, SyncService.name);
      }
    }

    txs = txs.filter(
      tx => tx.to.toLowerCase() === this.depositEthAddress.toLowerCase(),
    );

    this.logger.info(`ETH processRecentTxs txs size = ${txs.length}`);
    for (const tx of txs) {
      if (tx.txreceipt_status === '1') {
        await this.saveUserTransfer(tx, 'ETH');
      }
    }
  }

  /**
   * get recent ERC20 token transactions, save txs to db
   * @param tokenContractAddress
   * @param startBlock
   * @param endBlock
   */
  async processRecentTokenTxs(
    tokenName: string,
    tokenContractAddress: string,
    startBlock: number,
    endBlock: number,
  ) {
    // // get ERC20 token transactions
    let tokenTxs = [];
    try {
      tokenTxs = this.getResultFromEtherscanApiResponse(
        await this.etherscanApi.account.tokentx(
          this.depositEthAddress,
          tokenContractAddress,
          startBlock,
          endBlock,
        ),
      );
    } catch (err) {
      if (err === 'No transactions found') {
        this.logger.info(`${tokenName} fetch txs size == 0`, SyncService.name);
      } else {
        this.logger.error(
          `${tokenName} fetch txs failed: ${err}`,
          SyncService.name,
        );
      }
    }

    tokenTxs = tokenTxs.filter(
      tx => tx.to.toLowerCase() === this.depositEthAddress.toLowerCase(),
    );
    this.logger.info(
      `${tokenName} processRecentTokenTxs tokenTxs size = ${tokenTxs.length}`,
      SyncService.name,
    );

    for (const tokenTx of tokenTxs) {
      await this.saveUserTransfer(tokenTx, tokenName);
    }
  }

  /**
   * extract transfer info from transaction, save it to db
   * @param tx transaction from etherscan api response
   */
  async saveUserTransfer(tx: Transaction | TokenTransaction, token: string) {
    const { blockNumber, hash, from, to, value, confirmations } = tx;

    let transfer = await this.ethTransferModel.findOne({
      where: { txhash: hash },
    });

    if (!transfer) {
      transfer = new EthTransfer();
      transfer.txhash = hash;
      transfer.block = Number(blockNumber);
      transfer.currency = token;
      transfer.from = from;
      transfer.to = to;
      transfer.amount = Number(value);
      transfer.confirmations = Number(confirmations);
      transfer.status =
        transfer.confirmations >= 15
          ? SWAP_STATUS.CONFIRMED
          : SWAP_STATUS.CONFIRMING;
    } else if (transfer.status < 2) {
      transfer.confirmations = Number(confirmations);
      transfer.status =
        transfer.confirmations >= 15
          ? SWAP_STATUS.CONFIRMED
          : SWAP_STATUS.CONFIRMING;
    } else {
      this.logger.info(
        `txhash[${hash}] from[${from}] existed in db, will do nothing!`,
        SyncService.name,
      );
      return;
    }
    // set price related attributes
    if (transfer.status === SWAP_STATUS.CONFIRMED) {
      const tokenPrice = Number(
        await this.redisService.getClient().get(`${token.toLowerCase()}_price`),
      );
      const ckbPrice = Number(
        await this.redisService.getClient().get('CKB_price'),
      );
      const ckbAmount = this.calculateExchangeAssets(
        18,
        transfer.amount,
        tokenPrice,
        ckbPrice,
      );
      this.logger.info(
        `tokenPrice=${tokenPrice}, ckbPrice=${ckbPrice}, tokenAmount=${transfer.amount}, ckbAmount=${ckbAmount}`,
        SyncService.name,
      );
      transfer.currencyPrice = tokenPrice;
      transfer.ckbPrice = ckbPrice;
      transfer.ckbAmount = ckbAmount;
    }

    await transfer.save();
  }

  /**
   * calculate the corresponding ckb amount for received token at current price from exchanges
   * @param tokenDecimal
   * @param amount
   * @param tokenPrice
   * @param ckbPrice
   */
  calculateExchangeAssets(
    tokenDecimal: number,
    amount: number,
    tokenPrice: number,
    ckbPrice: number,
  ): number {
    const tokenPriceBN = web3Utils.toBN(
      Math.floor(Number(tokenPrice) * 10 ** 8),
    );
    const ckbPriceBN = web3Utils.toBN(Math.floor(Number(ckbPrice) * 10 ** 8));
    const ckbDecimal = 8;

    const feeRateBN = web3Utils.toBN((1 - this.config.SWAP_FEE_RATE) * 10000);
    const feeRateBaseBN = web3Utils.toBN(10000);

    const ckbAmount = Number(
      web3Utils
        .toBN(amount)
        .add(tokenPriceBN)
        .div(ckbPriceBN)
        .div(web3Utils.toBN(tokenDecimal - ckbDecimal))
        .mul(feeRateBN)
        .div(feeRateBaseBN)
        .toString(10),
    );

    return ckbAmount;
  }
}