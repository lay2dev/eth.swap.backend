import { PENDINGSWAP_REPOSITORY } from '../util/constant';
import { PendingSwap } from './pendingswap.entity';

export const pendingSwapProviders = [
  {
    provide: PENDINGSWAP_REPOSITORY,
    useValue: PendingSwap,
  },
];
