import { Module, HttpModule } from '@nestjs/common';
import { ExchangeModule } from './exchange/exchange.module';
import { ConfigModule } from './config/config.module';
import { ScheduleModule } from 'nest-schedule';
import { RedisModule } from 'nestjs-redis';
import { LoggerModule } from './logger/logger.module';
import { SyncModule } from './sync/sync.module';
import { CkbModule } from './ckb/ckb.module';
import { SwapModule } from './swap/swap.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ExchangeModule,
    HttpModule,
    LoggerModule,
    ConfigModule,
    ScheduleModule.register(),
    RedisModule.register({ url: 'redis://127.0.0.1:6379/1' }),
    SyncModule,
    CkbModule,
    SwapModule,
    NotificationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
