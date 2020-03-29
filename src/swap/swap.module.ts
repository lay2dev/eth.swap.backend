import { Module } from '@nestjs/common';
import { SwapService } from './swap.service';
import { SwapController } from './swap.controller';
import { ConfigModule } from 'src/config/config.module';
import { DatabaseModule } from 'src/database/database.module';
import { RedisModule } from 'nestjs-redis';
import { LoggerModule } from 'src/logger/logger.module';
import { ethTransferProviders } from 'src/exchange/ethtransfer.providers';

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, LoggerModule],
  providers: [SwapService, ...ethTransferProviders],
  controllers: [SwapController],
})
export class SwapModule {}
