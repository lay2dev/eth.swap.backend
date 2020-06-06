import { EthTransfer } from './ethtransfer.entity';
import { ETHTRANSFER_REPOSITORY, MMORDER_REPOSITORY } from '../util/constant';
import { MMOrder } from './mmorder.entity';

export const ethTransferProviders = [
  {
    provide: ETHTRANSFER_REPOSITORY,
    useValue: EthTransfer,
  },
  {
    provide: MMORDER_REPOSITORY,
    useValue: MMOrder,
  },
];
