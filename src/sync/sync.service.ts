import { Injectable, Inject } from '@nestjs/common';
import { NestSchedule, Interval } from 'nest-schedule';
import { EthTransfer } from '../exchange/ethtransfer.entity';
import { ETHTRANSFER_REPOSITORY, SWAP_STATUS, CKBConvertInfo } from '../util/constant';
import { LoggerService } from 'nest-logger';
import { ConfigService } from 'src/config/config.service';
import { Op } from 'sequelize';
import { init, EtherscanApi, Response, ProxyResponse, Transaction, TokenTransaction } from 'etherscan-api';
import { ExchangeService } from 'src/exchange/exchange.service';
import { CkbService } from 'src/ckb/ckb.service';
import { RedisService } from 'nestjs-redis';

@Injectable()
export class SyncService extends NestSchedule {
  private depositEthAddress: string;
  private etherscanApi: EtherscanApi;

  constructor(
    @Inject(ETHTRANSFER_REPOSITORY)
    private readonly ethTransferModel: typeof EthTransfer,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly exchangeService: ExchangeService,
    private readonly ckbService: CkbService,
    private readonly redisService: RedisService,
  ) {
    super();
    this.etherscanApi = init(this.config.get('ETHERSCAN_TOKEN'), this.config.get('ETH_CHAIN'));
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
  @Interval(5 * 1000)
  async syncEthTransfers() {
    // get eth latest block number
    const latestBlockNumber = Number(
      this.getResultFromEtherscanApiProxyResponse(await this.etherscanApi.proxy.eth_blockNumber()),
    );
    const lastProcessedBlockNumber = Number(
      (await this.ethTransferModel.max('block', {
        where: {
          status: {
            [Op.gte]: SWAP_STATUS.CONFIRMED,
          },
        },
      })) || 0,
    );
    this.logger.info(`startBlock=[${lastProcessedBlockNumber}], endBlock=[${latestBlockNumber}] `, SyncService.name);
    await this.processRecentTxs(lastProcessedBlockNumber + 1, latestBlockNumber);

    const erc20TokenList = this.config.tokenList.filter(v => v.symbol !== 'ETH');
    for (const token of erc20TokenList) {
      await this.processRecentTokenTxs(token.symbol, token.address, lastProcessedBlockNumber, latestBlockNumber);
    }
    this.logger.info(`syncEthTransfer job finished!`, SyncService.name);

    await this.redisService.getClient().set('swap_sync_eth_block_number', latestBlockNumber);
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
        await this.etherscanApi.account.txlist(this.depositEthAddress, startBlock, endBlock),
      );
    } catch (err) {
      if (err === 'No transactions found') {
        this.logger.info(`ETH fetch txs size == 0`, SyncService.name);
      } else {
        this.logger.error(`ETH fetch txs failed: ${err}`, SyncService.name);
      }
    }

    txs = txs.filter(tx => tx.to.toLowerCase() === this.depositEthAddress.toLowerCase());

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
  async processRecentTokenTxs(tokenName: string, tokenContractAddress: string, startBlock: number, endBlock: number) {
    // // get ERC20 token transactions
    let tokenTxs = [];
    try {
      tokenTxs = this.getResultFromEtherscanApiResponse(
        await this.etherscanApi.account.tokentx(this.depositEthAddress, tokenContractAddress, startBlock, endBlock),
      );
    } catch (err) {
      if (err === 'No transactions found') {
        this.logger.info(`${tokenName} fetch txs size == 0`, SyncService.name);
      } else {
        this.logger.error(`${tokenName} fetch txs failed: ${err}`, SyncService.name);
      }
    }

    tokenTxs = tokenTxs.filter(tx => tx.to.toLowerCase() === this.depositEthAddress.toLowerCase());
    this.logger.info(`${tokenName} processRecentTokenTxs tokenTxs size = ${tokenTxs.length}`, SyncService.name);

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
        transfer.confirmations >= this.config.ETH_DEPOSIT_CONFIRMATIONS
          ? SWAP_STATUS.CONFIRMED
          : SWAP_STATUS.CONFIRMING;
    } else if (transfer.status < 2) {
      transfer.block = Number(blockNumber);
      transfer.currency = token;
      transfer.from = from;
      transfer.to = to;
      transfer.amount = Number(value);

      transfer.confirmations = Number(confirmations);
      transfer.status =
        transfer.confirmations >= this.config.ETH_DEPOSIT_CONFIRMATIONS
          ? SWAP_STATUS.CONFIRMED
          : SWAP_STATUS.CONFIRMING;
    } else {
      this.logger.info(`txhash[${hash}] from[${from}] existed in db, will do nothing!`, SyncService.name);
      return;
    }

    // set price related attributes
    if (transfer.status === SWAP_STATUS.CONFIRMED) {
      // user not send transfer request
      if (!transfer.ckbAmount) {
        transfer.status = SWAP_STATUS.IGNORED;
      } else {
        const {
          swapFeeAmount,
          ckbAmount: convertedCkbAmount,
          tokenPrice,
          ckbPrice,
        } = await this.exchangeService.ConvertAsset(token, transfer.amount);
        this.logger.info(
          `tokenPrice=${tokenPrice}, ckbPrice=${ckbPrice}, tokenAmount=${transfer.amount}, ckbAmount=${transfer.ckbAmount}, convertedCkbAmount = ${convertedCkbAmount}`,
          SyncService.name,
        );

        if (
          convertedCkbAmount / 10 ** 8 < this.config.MIN_TRANSFER_CKB_AMOUNT ||
          convertedCkbAmount / 10 ** 8 > this.config.MAX_TRANSFER_CKB_AMOUNT ||
          !transfer.ckbAmount
        ) {
          transfer.status = SWAP_STATUS.IGNORED;
        }

        transfer.currencyPrice = tokenPrice;
        transfer.ckbPrice = ckbPrice;
        transfer.convertedCkbAmount = convertedCkbAmount;
        transfer.swapFee = swapFeeAmount;
        transfer.transferCkbAmount = Math.min(Math.round(convertedCkbAmount / 10 ** 8) * 10 ** 8, transfer.ckbAmount);
      }
    }

    await transfer.save();

    if (transfer.status === SWAP_STATUS.CONFIRMED) {
      await this.ckbService.deliverCKB(transfer);
    }
  }
}
