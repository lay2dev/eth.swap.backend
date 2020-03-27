import { Module, Global, HttpModule } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { CkbService } from './ckb.service';
import { DatabaseModule } from 'src/database/database.module';
import { LoggerModule } from 'src/logger/logger.module';
import { ethTransferProviders } from 'src/exchange/ethtransfer.providers';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, LoggerModule, HttpModule],
  providers: [CkbService, ...ethTransferProviders],
  exports: [CkbService],
})
export class CkbModule {}
