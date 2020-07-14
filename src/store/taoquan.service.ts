import { Injectable, HttpService } from '@nestjs/common';

import { LoggerService } from 'nest-logger';
import { createHash } from 'crypto';
import * as QS from 'querystring';

@Injectable()
export class TaoquanService {
  private baseURL = 'http://test.api.365taoquan.cn:11140/api';
  private placeOrderURL = this.baseURL + '/orderV2/payOrder';
  private refundOrderURL = this.baseURL + '/orderV2/refund';
  private queryProductInventoryURL = this.baseURL + '/stock/queryByProductId';
  private queryProductDetailURL = this.baseURL + '/product/queryProductDetailByProductId';
  private queryOrderStatusURL = this.baseURL + '/orderV2/queryOrderStatus';
  private queryOrderForApiURL = this.baseURL + '/orderV2/queryOrderForApi';

  private appId = '8997';
  private tradeKey = 'drzHhrSHRrNkc7fDBBDjpXycDMZddzPa';

  constructor(private readonly httpService: HttpService, private readonly logger: LoggerService) {}

  async placeOrder(productId: string, count: number, notifyUrl: string) {
    const outTradeNo = 'lay2shopxxx' + new Date().getTime();

    const request = {
      app_id: this.appId,
      out_trade_no: outTradeNo,
      product_id: productId,
      count,
      // notify_url: notifyUrl,
      time_stamp: new Date().getTime(),
      sign: '',
    };
    request.sign = this.signRequest(request);

    const response = this.requestAPI(this.placeOrderURL, request);
    return response;
  }

  async refundOrder(orderNo: string) {
    const request = {
      app_id: this.appId,
      order_no: orderNo,
      time_stamp: new Date().getTime(),
      sign: '',
    };

    request.sign = this.signRequest(request);

    const response = this.requestAPI(this.refundOrderURL, request);
    return response;
  }

  async queryProductInventory(productId: string) {
    const request = {
      app_id: this.appId,
      product_id: productId,
      time_stamp: new Date().getTime(),
      sign: '',
    };
    request.sign = this.signRequest(request);

    this.logger.info(`productInventory request: ${JSON.stringify(request)}`, TaoquanService.name);

    const response = this.requestAPI(this.queryProductInventoryURL, request);
    return response;
  }

  async queryProductDetail(productId: string) {
    const request = {
      app_id: this.appId,
      product_id: productId,
      time_stamp: new Date().getTime(),
      sign: '',
    };
    request.sign = this.signRequest(request);

    const response = this.requestAPI(this.queryProductDetailURL, request);
    return response;
  }

  async queryOrderStatus(orderNo: string) {
    const request = {
      order_no: orderNo,
      app_id: this.appId,
      time_stamp: new Date().getTime(),
      sign: '',
    };
    request.sign = this.signRequest(request);

    const response = this.requestAPI(this.queryOrderStatusURL, request);
    return response;
  }

  async queryOrderForAPI(userOrderNo: string) {
    const request = {
      user_order_no: userOrderNo,
      app_id: this.appId,
      time_stamp: new Date().getTime(),
      sign: '',
    };
    request.sign = this.signRequest(request);

    const response = this.requestAPI(this.queryOrderForApiURL, request);
    return response;
  }

  async handleCallback(callbackResp): Promise<boolean> {
    const { order_no, order_status, time_stamp, sign } = callbackResp;
    const data = { order_no, order_status, time_stamp };
    const newSign = this.signRequest(data);

    if (sign === newSign) {
      // TODO: other operattions
      return true;
    } else {
      throw new Error('sign verify failed');
    }
  }

  async requestAPI(url, data) {
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const params = QS.stringify(data);
    this.logger.info(`request params: ${params}`, TaoquanService.name);

    const response = await this.httpService.post(url, params, config).toPromise();
    return response.data;
  }

  signRequest(request): string {
    const newRequest = {};
    Object.keys(request)
      .sort()
      .forEach(key => {
        if (key !== 'sign') {
          newRequest[key] = request[key];
        }
      });
    let str = Object.keys(newRequest)
      .map(key => key + newRequest[key])
      .join('');
    // for (const key of Object.keys(newRequest)) {
    //   str += ;
    // }

    str += this.tradeKey;
    // app_id8997product_id15001003time_stamp1591585655596drzHhrSHRrNkc7fDBBDjpXycDMZddzPa
    this.logger.info(`signRequest str: ${str}`);
    // const hash = MD5(str).toString(enc.Hex);
    const hash = createHash('md5')
      .update(str)
      .digest('hex')
      .toUpperCase();
    // a75c45c9c0fea23ebdbc56c6bc1d3315
    // FF90ECCA91576C96DAE476EC2915A4E8
    this.logger.info(`signRequest MD5: ${hash}`);

    return hash;
  }
}
