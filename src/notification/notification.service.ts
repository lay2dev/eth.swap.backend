import { Injectable, HttpService } from '@nestjs/common';
import { ConfigService } from 'src/config/config.service';
import { LoggerService } from 'nest-logger';
import { EthTransfer } from 'src/exchange/ethtransfer.entity';
import { SWAP_STATUS } from 'src/util/constant';
import { fromWei, toBN } from 'web3-utils';
import { format } from 'util';

@Injectable()
export class NotificationService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
  ) {}

  async sendErrorInfo(info, exception) {
    try {
      const content = format('Error Info: %s %s ', info, exception instanceof Error ? exception?.stack : exception);
      const swapWebHook = this.configService.SWAP_WEBHOOK;
      const result = await this.httpService
        .post(swapWebHook, content, {
          headers: {
            'Content-Type': 'application/json',
          },
        })
        .toPromise();
      return result.data;
    } catch (err) {
      this.loggerService.error('send err info failed', info);
    }
  }

  async sendSwapResult(ethTransfer: EthTransfer, success: boolean) {
    const content = this.buildNotification(ethTransfer, success);
    const swapWebHook = this.configService.SWAP_WEBHOOK;
    const result = await this.httpService
      .post(swapWebHook, content, {
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .toPromise();
    return result.data;
  }

  buildNotification(ethTransfer: EthTransfer, success: boolean) {
    let title = 'SWAP SUCCESS';
    let color = 0x32cd32;
    if (success) {
      title = 'SWAP SUCCESS';
      color = 0x32cd32;
    } else {
      title = 'SWAP FAILED';
      color = 0xdc143c;
    }

    const { txhash, amount, ckbAmount, ckbTxHash, from, currency, convertedCkbAmount, transferCkbAmount } = ethTransfer;

    const tokenDecimal = this.configService.tokenList.filter(item => item.symbol === currency)[0].decimal;
    const tokenAmount =
      Number(
        toBN(amount)
          .div(toBN(10 ** (tokenDecimal - 4)))
          .toString(10),
      ) / 10000;

    const requestCKBAmount = (ckbAmount / 100000000).toFixed(2);
    const exchangeCKBAmount = (convertedCkbAmount / 100000000).toFixed(2);
    const userReceivedCKBAmount = (transferCkbAmount / 100000000).toFixed(2);

    const url = `${this.configService.ETH_EXPLORER_URL}tx/${ethTransfer.txhash}`;
    const description = `${from} request ${requestCKBAmount}CKBytes with ${tokenAmount}${currency} \n EXCHANGE : TRANSFER = ${exchangeCKBAmount} : ${userReceivedCKBAmount}`;

    return {
      tts: false,
      embeds: [
        {
          title,
          url,
          description,
          color,
          fields: [
            { name: 'ETH txHash', value: txhash },
            { name: 'CKB txHash', value: ckbTxHash },
          ],
        },
      ],
    };
  }
}
