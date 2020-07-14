import { Module, HttpModule } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { TaoquanService } from './taoquan.service';
import { LoggerModule } from 'src/logger/logger.module';
import { DatabaseModule } from 'src/database/database.module';
import { ConfigModule } from 'src/config/config.module';

@Module({
  imports: [HttpModule, LoggerModule, DatabaseModule, ConfigModule],
  controllers: [StoreController],
  providers: [StoreService, TaoquanService],
})
export class StoreModule {}
