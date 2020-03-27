import { Module } from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { DatabaseModule } from 'src/database/database.module';
import { LoggerModule } from 'src/logger/logger.module';
import { ConfigModule } from 'src/config/config.module';
import { RedisModule } from 'nestjs-redis';
import { ethTransferProviders } from './ethtransfer.providers';

@Module({
  imports: [DatabaseModule, LoggerModule, ConfigModule, RedisModule],
  controllers: [],
  providers: [ExchangeService, ...ethTransferProviders],
})
export class ExchangeModule {}
