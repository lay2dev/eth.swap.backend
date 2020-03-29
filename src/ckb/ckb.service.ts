import { Injectable, Inject, HttpService } from '@nestjs/common';
import Core from '@nervosnetwork/ckb-sdk-core';
import {
  AddressPrefix,
  calculateTransactionFee,
} from '@nervosnetwork/ckb-sdk-utils';
import { ConfigService } from 'src/config/config.service';
import * as http from 'http';
import { NestSchedule, Interval } from 'nest-schedule';
import { ETHTRANSFER_REPOSITORY, SWAP_STATUS } from 'src/util/constant';
import { EthTransfer } from 'src/exchange/ethtransfer.entity';
import { LoggerService } from 'nest-logger';
import { RedisService } from 'nestjs-redis';
import { Cell } from '@nervosnetwork/ckb-sdk-core/lib/generateRawTransaction';
import { getTxSize } from '../util/txSize';
import { numberToHex } from 'web3-utils';

export declare type CellPlus = Cell & { id: string };

@Injectable()
export class CkbService extends NestSchedule {
  private ckb: Core;
  private chain: AddressPrefix;

  constructor(
    @Inject(ETHTRANSFER_REPOSITORY)
    private readonly ethTransferModel: typeof EthTransfer,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
    private readonly redisService: RedisService,
    private readonly httpService: HttpService,
  ) {
    super();

    this.ckb = new Core(this.config.CKB_RPC_ENDPOINT);
    this.chain = AddressPrefix.Mainnet;

    this.ckb.rpc.setNode({
      httpAgent: new http.Agent({ keepAlive: true }),
    } as CKBComponents.Node);

    this.ckb.rpc.getBlockchainInfo().then(result => {
      this.chain = result.chain as AddressPrefix;
    });
  }

  /**
   * return ckb instance
   */
  getCKB(): Core {
    return this.ckb;
  }

  /**
   * return ckb chain type "ckb" or "ckt"
   */
  getChain(): AddressPrefix {
    return this.chain;
  }

  /**
   * deliver CKB to user according to eth transfer's status
   */
  @Interval(5 * 1000)
  async checkDeliverCKB() {
    // check status of delivering txs on CKB, update transfer status to finished
    const deliveredTransfers = await this.ethTransferModel.findAll({
      where: { status: SWAP_STATUS.DELIVERING },
    });

    for (const deliveredTransfer of deliveredTransfers) {
      const txStatus = (
        await this.getTxStatus(deliveredTransfer.ckbTxHash)
      ).toString();
      if (txStatus === 'committed') {
        deliveredTransfer.status = SWAP_STATUS.DELIVERED;
        await deliveredTransfer.save();
      }
    }

    // concurrent problem here
    const unDevliveredTransfers = await this.ethTransferModel.findAll({
      where: { status: SWAP_STATUS.CONFIRMED },
    });

    // devliver CKB
    for (const unDevliveredTransfer of unDevliveredTransfers) {
      await this.deliverCKB(unDevliveredTransfer);
    }
  }

  async deliverCKB(transfer: EthTransfer) {
    // build ckb transaction
    const ckb = this.getCKB();
    const capacity = transfer.transferCkbAmount;

    if (capacity < 61 * 10 ** 8) {
      this.logger.error(
        `capacity ${capacity} is less than 61 CKBytes`,
        CkbService.name,
      );
      return;
    }

    ckb.config.secp256k1Dep = await this.loadSecp256k1Cell();

    const privateKey = this.config.CKB_PRIVATE_KEY;
    const publicKey = ckb.utils.privateKeyToPublicKey(privateKey);
    const publicKeyHash = `0x${ckb.utils.blake160(publicKey, 'hex')}`;
    const fromAddress = ckb.utils.pubkeyToAddress(publicKey);
    const toAddress = fromAddress;

    const senderLock: CKBComponents.Script = {
      hashType: 'type',
      codeHash:
        '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
      args: publicKeyHash,
    };

    const lockHash = ckb.utils.scriptToHash(senderLock);
    const redisLastIdKey = `unspent_lastId_${lockHash}`;
    const lastId = await this.redisService.getClient().get(redisLastIdKey);

    const unspentCells = await this.getUnspentCell(
      lockHash,
      capacity.toString(),
      Number(lastId || 0),
    );

    await this.redisService
      .getClient()
      .set(redisLastIdKey, unspentCells[unspentCells.length - 1].id);

    const tx1 = await ckb.generateRawTransaction({
      fromAddress,
      toAddress,
      capacity: BigInt(capacity),
      fee: BigInt(0),
      safeMode: true,
      cells: unspentCells,
      deps: ckb.config.secp256k1Dep,
    });
    tx1.witnesses = tx1.inputs.map(() => '0x');
    tx1.witnesses.unshift({ lock: '', inputType: '', outputType: '' });
    const txSize = getTxSize(tx1);
    const fee = calculateTransactionFee(
      numberToHex(txSize),
      numberToHex(this.config.CKB_TX_FEE_RATE),
    );

    const rawTransaction = await ckb.generateRawTransaction({
      fromAddress,
      toAddress,
      capacity: BigInt(capacity),
      fee: BigInt(fee),
      safeMode: true,
      cells: unspentCells,
      deps: ckb.config.secp256k1Dep,
    });

    rawTransaction.outputs[0].lock = {
      hashType: 'type',
      codeHash: this.config.ETH_LOCK_TYPE_ID,
      args: transfer.from,
    };
    rawTransaction.witnesses = rawTransaction.inputs.map(() => '0x');
    rawTransaction.witnesses[0] = {
      lock: '',
      inputType: '',
      outputType: '',
    };

    // sign transaction
    const signedTx = ckb.signTransaction(privateKey)(rawTransaction, null);
    // send to ckb node and get txHash
    this.logger.info(`signedTx  ${JSON.stringify(signedTx)}`, CkbService.name);
    const realTxHash = await ckb.rpc.sendTransaction(signedTx);
    // set txHash to database, update transfer status
    transfer.transferCkbFee = Number(fee);
    transfer.ckbTxHash = realTxHash;
    transfer.status = SWAP_STATUS.DELIVERING;
    await transfer.save();

    return true;
  }

  async loadSecp256k1Cell(): Promise<DepCellInfo> {
    const url = `${this.config.CKB_CELLMAP_URL}/cell/loadSecp256k1Cell`;
    const secp256k1Cell = await this.httpService
      .get(url, {
        headers: {
          'Content-Type': 'application/vnd.api+json',
        },
      })
      .toPromise();

    // console.log('secp256k1Celll', secp256k1Cell);

    return secp256k1Cell.data;
  }

  async getUnspentCell(
    lockHash: string,
    capacity: string,
    lastId: number,
  ): Promise<CellPlus[]> {
    const url = `${this.config.CKB_CELLMAP_URL}/cell/unSpent`;
    const response = await this.httpService
      .get(url, {
        headers: {
          'Content-Type': 'application/vnd.api+json',
        },
        params: {
          lockHash,
          capacity,
          lastId,
        },
      })
      .toPromise();

    return response.data;
  }

  async getTxStatus(txHash: string) {
    const tx = await this.ckb.rpc.getTransaction(txHash);
    return tx.txStatus.status;
  }
}
