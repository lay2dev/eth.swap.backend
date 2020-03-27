import { Module } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { RedisModule } from 'nestjs-redis';
import { DatabaseModule } from 'src/database/database.module';
import { SyncService } from './sync.service';
import { LoggerModule } from 'src/logger/logger.module';
import { ethTransferProviders } from 'src/exchange/ethtransfer.providers';

@Module({
  imports: [ConfigModule, LoggerModule, RedisModule, DatabaseModule],
  providers: [SyncService, ...ethTransferProviders],
})
export class SyncModule {}
