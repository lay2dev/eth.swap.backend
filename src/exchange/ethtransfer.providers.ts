import { EthTransfer } from './ethtransfer.entity';
import { ETHTRANSFER_REPOSITORY } from '../util/constant';

export const ethTransferProviders = [
  {
    provide: ETHTRANSFER_REPOSITORY,
    useValue: EthTransfer,
  },
];
