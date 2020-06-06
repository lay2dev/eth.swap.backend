import { Module } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { DatabaseModule } from 'src/database/database.module';
import { LoggerModule } from 'src/logger/logger.module';
import { ConfigModule } from 'src/config/config.module';
import { RedisModule } from 'nestjs-redis';
import { ethTransferProviders } from './ethtransfer.providers';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [DatabaseModule, LoggerModule, ConfigModule, RedisModule, NotificationModule],
  controllers: [],
  providers: [ExchangeService, ...ethTransferProviders],
  exports: [ExchangeService],
})
export class ExchangeModule {}
