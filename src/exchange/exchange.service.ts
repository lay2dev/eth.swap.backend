import { Injectable, Inject } from '@nestjs/common';
import { NestSchedule, Interval } from 'nest-schedule';
import { EthTransfer } from './ethtransfer.entity';
import {
  ETHTRANSFER_REPOSITORY,
  CKBConvertInfo,
  SWAP_STATUS,
  EXCHANGE_STATUS,
  ExchangeAssetRequest,
} from '../util/constant';
import { LoggerService } from 'nest-logger';
import { ConfigService } from 'src/config/config.service';
import { huobipro } from 'ccxt';
import { RedisService } from 'nestjs-redis';
import * as web3Utils from 'web3-utils';
import { MMOrder } from './mmorder.entity';
import { Op } from 'sequelize';
import { NotificationService } from 'src/notification/notification.service';
import { client } from 'websocket';
import * as Pako from 'pako';
import { authHuobiWS } from 'src/util/hbg';
import { Clearing } from './clearing.entity';

@Injectable()
export class ExchangeService extends NestSchedule {
  private huobiClient: huobipro;
  private accountId: string;
  private exchanging = false;
  private initialized = false;
  private marketWSStatus = false;
  private assetOrderWSStatus = false;

  private assetPrices = {};
  private assetBalance = {};

  constructor(
    @Inject(ETHTRANSFER_REPOSITORY)
    private readonly ethTransferModel: typeof EthTransfer,
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
  ) {
    super();
    this.huobiClient = new huobipro({
      apiKey: this.config.HUOBI_AK,
      secret: this.config.HUOBI_SK,
      enableRateLimit: true,
    });

    this.assetPrices['CKB'] = { symbol: 'CKB', price: 1 };
    this.assetBalance['CKB'] = 0;
    for (const token of this.config.tokenList) {
      const { symbol } = token;
      this.assetPrices[symbol] = { symbol, price: 1 };
      this.assetBalance[symbol] = 0;
    }
    if (this.config.ENABLE_EXCHANGE) {
      this.initExchange();
      this.initWSMarketData();
      this.initWSAssetOrder();
    }
  }

  async initExchange() {
    const accounts = await this.huobiClient.fetchAccounts();
    const accountId = accounts[0].id;
    this.accountId = accountId;
    this.logger.info(`accountId is ${accountId}`);
    // const limits = await this.huobiClient.fetchTradingLimits(['ETH/USDT', 'CKB/USDT']);
    // console.log('limits', limits);

    this.initialized = true;
  }

  getAssetPrice() {
    // let minSwapCKBAmount = 100;
    // await this.redisService.getClient().set(`MIN_SWAP_CKB_AMOUNT`, minSwapCKBAmount);
    if (!this.marketWSStatus) {
      throw new Error('price not initialized');
    }

    return this.assetPrices;
  }

  /**
   * using web socket to update asset price in real time
   */
  initWSMarketData() {
    const ws = new client();

    const wsConfigs = [];
    const ckbConfig = { symbol: 'CKB', subBBO: { sub: 'market.ckbusdt.bbo', id: 'id5' } };
    wsConfigs.push(ckbConfig);
    for (const token of this.config.tokenList) {
      const { symbol } = token;
      if (symbol === 'USDT') {
        continue;
      }
      const lowercaseSymbol = (symbol + 'usdt').toLowerCase();
      const subBBO = { sub: `market.${lowercaseSymbol}.bbo`, id: 'id6' };
      wsConfigs.push({ symbol, subBBO });
    }

    ws.on('connect', conn => {
      this.logger.info(`on connect`, 'WSMarket');

      this.marketWSStatus = true;

      // subscribe symbol bbo
      for (const wsConfig of wsConfigs) {
        conn.send(JSON.stringify(wsConfig.subBBO));
      }

      conn.on('frame', frame => {
        // console.log(`on frame - ${frame.binaryPayload.toString()}`);
      });
      conn.on('message', data => {
        const text = Pako.inflate(data.binaryData, {
          to: 'string',
        });
        const msg = JSON.parse(text);
        if (msg.ping) {
          conn.send(JSON.stringify({ pong: msg.ping }));
        } else if (msg.tick) {
          for (const config of wsConfigs) {
            const { symbol, subBBO } = config;

            if (msg.ch === subBBO.sub) {
              const { bid, ask } = msg.tick;
              // console.log(msg.ch, symbol, bid, ask);
              if (symbol === 'CKB') {
                this.assetPrices[symbol].price = ask;
              } else {
                this.assetPrices[symbol].price = bid;
              }
            }
          }
        } else {
          this.logger.info(text, 'WSMarket');
        }
      });
    });
    ws.on('connectFailed', err => {
      this.logger.error(`on failed: ${err}`, 'WSMarket');
      this.notificationService.sendErrorInfo(`WSMarket on failed`, err);
      this.marketWSStatus = false;
      ws.connect(this.config.HBG_WS_URL);
    });
    ws.connect(this.config.HBG_WS_URL);
  }

  initWSAssetOrder() {
    const ws = new client();

    const accountUpdateSub = { action: 'sub', ch: 'accounts.update#0' };
    const wsConfigs = [];
    const ckbConfig = { symbol: 'CKB', sub: { action: 'sub', ch: `trade.clearing#ckbusdt` } };
    wsConfigs.push(ckbConfig);
    for (const token of this.config.tokenList) {
      const { symbol } = token;
      if (symbol === 'USDT') {
        continue;
      }
      const lowercaseSymbol = (symbol + 'usdt').toLowerCase();
      const sub = { action: 'sub', ch: `trade.clearing#${lowercaseSymbol}` };
      wsConfigs.push({ symbol, sub });
    }

    ws.on('connect', conn => {
      this.logger.info(`on connect`, 'WSAsset');
      // auth
      const authRequest = {
        action: 'req',
        ch: 'auth',
        params: authHuobiWS(this.config.HUOBI_AK, this.config.HUOBI_SK),
      };
      conn.send(JSON.stringify(authRequest));

      // handle msg

      conn.on('frame', frame => {
        // console.log(`on frame - ${frame.binaryPayload.toString()}`);
      });
      conn.on('message', data => {
        const msg = JSON.parse(data.utf8Data);
        // this.logger.info(`receive msg: ${data.utf8Data}`, 'WSAsset');

        if (msg.action === 'ping') {
          // console.log('response ping');
          conn.send(JSON.stringify({ action: 'pong', data: msg.data }));
        } else if (msg.action === 'req') {
          const { ch, code } = msg;

          // auth success
          if (ch === 'auth' && code === 200) {
            this.assetOrderWSStatus = true;

            // sub
            for (const config of wsConfigs) {
              conn.send(JSON.stringify(config.sub));
            }
            conn.send(JSON.stringify(accountUpdateSub));
          }
        } else if (msg.action === 'sub') {
          const { ch, code } = msg;
        } else if (msg.action === 'push') {
          this.logger.info(`receive push msg ${data.utf8Data}`);
          if (msg.ch === accountUpdateSub.ch) {
            // update account balance
            const { currency, balance } = msg.data;
            if (Object.keys(this.assetBalance).includes(currency.toUpperCase())) {
              this.assetBalance[currency.toUpperCase()] = balance;
            }
          } else {
            const {
              ch,
              data: { orderId },
            } = msg;
            this.logger.info('clearing orderId: ' + orderId, 'WSAsset');
            const clear = new Clearing();
            Object.assign(clear, msg.data);
            clear.save();
          }
        }
      });
    });

    ws.on('connectFailed', err => {
      this.assetOrderWSStatus = false;
      this.logger.error(`on failed: ${err}`, 'WSAsset');
      this.notificationService.sendErrorInfo(`WSAsset on failed:`, err);

      ws.connect(this.config.HBG_WS_URL + '/v2');
    });

    ws.connect(this.config.HBG_WS_URL + '/v2');
  }

  @Interval(5 * 1000)
  async checkExchangeStatus() {
    if (this.exchanging || !this.initialized) {
      return;
    }

    this.exchanging = true;
    const unExchangedTransfers = await this.ethTransferModel.findAll({
      where: {
        status: {
          [Op.in]: [SWAP_STATUS.DELIVERING, SWAP_STATUS.CONFIRMED, SWAP_STATUS.DELIVERED],
        },
        exchangeStatus: EXCHANGE_STATUS.NOT_EXCHANGE,
      },
    });

    this.logger.info(`start exchange transfers length = ${unExchangedTransfers.length}`, ExchangeService.name);
    // group transfers by currency

    const list: ExchangeAssetRequest[] = [];

    for (const token of this.config.tokenList) {
      list.push({
        currency: token.symbol,
        amount: 0,
        swapFee: 0,
        ckbAmount: 0,
        transferList: [],
      });
    }
    for (const transfer of unExchangedTransfers) {
      const { currency, amount, swapFee, ckbAmount } = transfer;
      const request = list.filter(x => x.currency === currency)[0];
      request.amount += Number(amount);
      request.swapFee += Number(swapFee);
      request.ckbAmount += Number(ckbAmount);
      request.transferList.push(transfer);
    }

    try {
      for (const currencyExchangeRequest of list) {
        const { currency, amount } = currencyExchangeRequest;
        // check amount value > 5 USDT
        const tokenInfo = this.config.tokenList.filter(v => v.symbol === currency)[0];
        const currencyPrice = Number(await this.redisService.getClient().get(`${currency.toUpperCase()}_price`));
        const assetValue = (amount / 10 ** tokenInfo.decimal) * currencyPrice;

        if (assetValue > 5) {
          await this.exchangeAsset(currencyExchangeRequest);
        }
      }
    } catch (err) {
      this.logger.error(`exchange transfers failed`, err instanceof Error ? err?.stack : err, ExchangeService.name);
      this.notificationService.sendErrorInfo('exchange transfers failed', err);

      console.log('err', err);
    } finally {
      this.exchanging = false;
    }
  }

  // TODO: check account balance is enough, otherwise notify admin to deposit ETH/USDT/HBPOINT
  async checkAccountBalance() {}

  async sellAsset(tokenName: string, amount: number): Promise<MMOrder> {
    const symbol = `${tokenName.toLowerCase()}usdt`;
    try {
      // place market order
      const order = await this.huobiClient.privatePostOrderOrdersPlace({
        'account-id': this.accountId,
        symbol,
        type: 'sell-market',
        amount,
      });
      // query order result
      this.logger.info(`place sell-market order: ${JSON.stringify(order)}`);
      const { data: id } = order;
      const result = await this.huobiClient.privateGetOrderOrdersId({
        'account-id': this.accountId,
        id,
      });
      this.logger.info(`sell-market order result: ${JSON.stringify(result)}`);
      // save order result
      const mmOrder = this.convertMMOrder(result.data);
      await mmOrder.save();
      return mmOrder;
    } catch (err) {
      this.logger.error(
        `sellAsset ${tokenName} ${amount} failed`,
        err instanceof Error ? err?.stack : err,
        ExchangeService.name,
      );
      throw err;
    }
  }

  async buyAsset(tokenName: string, amount: number): Promise<MMOrder> {
    const symbol = `${tokenName.toLowerCase()}usdt`;
    try {
      // place market order
      const order = await this.huobiClient.privatePostOrderOrdersPlace({
        'account-id': this.accountId,
        symbol,
        type: 'buy-market',
        amount,
      });
      // query order result
      this.logger.info(`place buy-market order: ${JSON.stringify(order)}`);
      const { data: id } = order;
      const result = await this.huobiClient.privateGetOrderOrdersId({
        'account-id': this.accountId,
        id,
      });
      this.logger.info(`buy-market order result: ${JSON.stringify(result)}`);
      // save order result
      const mmOrder = this.convertMMOrder(result.data);
      await mmOrder.save();

      // return order result
      return mmOrder;
    } catch (err) {
      this.logger.error(
        `buyAsset ${tokenName} ${amount} failed`,
        err instanceof Error ? err?.stack : err,
        ExchangeService.name,
      );
      throw err;
    }
  }

  convertMMOrder(result): MMOrder {
    const mmOrder = new MMOrder();
    const { id, symbol, amount, price, source, state, type, operator } = result;

    mmOrder.setAttributes({ id, symbol, amount, price, source, state, type, operator });
    mmOrder.canceledAt = result['canceled-at'];
    mmOrder.createdAt = result['created-at'];
    mmOrder.fieldAmount = result['field-amount'];
    mmOrder.fieldCashAmount = result['field-cash-amount'];
    mmOrder.fieldFees = result['field-fees'];
    mmOrder.finishedAt = result['finished-at'];
    mmOrder.clientOrderId = result['client-order-id'];
    mmOrder.stopPrice = result['stop-price'];

    return mmOrder;
  }

  async exchangeAsset(currencyExchangeRequest: ExchangeAssetRequest) {
    const { currency: tokenName, amount, swapFee, ckbAmount, transferList } = currencyExchangeRequest;
    this.logger.info(`start exchange assets ${JSON.stringify({ tokenName, amount, swapFee, ckbAmount })}`);

    for (const transfer of transferList) {
      transfer.exchangeStatus = EXCHANGE_STATUS.EXCHANGING;
      await transfer.save();
    }

    const tokenDecimal = this.config.tokenList.filter(item => item.symbol === tokenName)[0].decimal;

    const exchangeAmount = Number((amount / 10 ** tokenDecimal).toFixed(4));
    this.logger.info(`mm will sell ${exchangeAmount} ${tokenName} `);

    let sellOrderId = null;
    let sellAmount = 0;
    if (tokenName.toUpperCase() === 'USDT') {
      sellAmount = exchangeAmount;
    } else {
      const sellOrder = await this.sellAsset(tokenName, exchangeAmount);
      sellOrderId = sellOrder.id;
      sellAmount = Number((Number(sellOrder.fieldCashAmount) - Number(sellOrder.fieldFees)).toFixed(8));
    }

    this.logger.info(`mm will buy ckb with ${sellAmount} USDT`);
    const buyOrder = await this.buyAsset('CKB', sellAmount);

    const buyOrderId = buyOrder.id;
    const buyAmount = Number(buyOrder.fieldAmount) - Number(buyOrder.fieldFees);

    const avgTokenPrice = sellAmount / exchangeAmount;
    const avgCkbPrice = sellAmount / buyAmount;

    this.logger.info(
      `finish exchangeAsset CKB=[${buyAmount}], USDT=[${sellAmount}], ${tokenName}=[${exchangeAmount}], avgTokenPrice=[${avgTokenPrice}], avgCKBPrice=[${avgCkbPrice}]`,
      ExchangeService.name,
    );

    for (const transfer of transferList) {
      transfer.sellCurrencyOrderId = sellOrderId;
      transfer.buyCKBOrderId = buyOrderId;
      transfer.avgCkbExchangePrice = avgCkbPrice;
      transfer.avgCurrencyExchangePrice = avgTokenPrice;
      transfer.ckbExchangeAmount = buyAmount * (transfer.amount / amount) * 10 ** 8;
      transfer.exchangeStatus = EXCHANGE_STATUS.EXCHANGED;
      await transfer.save();
    }
  }

  /**
   * SIMPLE TRANSFER STRATEGY.
   * TODO: will be subsititued by exchange API.
   * calculate the corresponding ckb amount for received token at current price from exchanges
   * @param tokenName
   * @param amount
   */
  async estimateExchangeAsset(tokenName: string, amount: number): Promise<CKBConvertInfo> {
    const tokenPrice = Number(await this.redisService.getClient().get(`${tokenName.toUpperCase()}_price`));
    const ckbPrice = Number(await this.redisService.getClient().get('CKB_price'));
    this.logger.info(
      `estimateExchangeAsset tokenName = [${tokenName}] amount= [${amount}] tokenPrice = [${tokenPrice}] ckbPrice = [${ckbPrice}]`,
    );

    const tokenDecimal = this.config.tokenList.filter(item => item.symbol === tokenName)[0].decimal;

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
