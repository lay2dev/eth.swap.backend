import { Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { RedisModule } from 'nestjs-redis';
import { DatabaseModule } from 'src/database/database.module';
import { SyncService } from './sync.service';
import { LoggerModule } from 'src/logger/logger.module';
import { ethTransferProviders } from 'src/exchange/ethtransfer.providers';
import { ExchangeModule } from 'src/exchange/exchange.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    RedisModule,
    DatabaseModule,
    ExchangeModule,
  ],
  providers: [SyncService, ...ethTransferProviders],
})
export class SyncModule {}
