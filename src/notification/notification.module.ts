import { Module, HttpModule } from '@nestjs/common';
import { ConfigModule } from 'src/config/config.module';
import { LoggerModule } from 'src/logger/logger.module';
import { NotificationService } from './notification.service';

@Module({
  imports: [HttpModule, ConfigModule, LoggerModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
