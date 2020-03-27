import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { LoggerService } from 'nest-logger';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: LoggerService,
      useFactory: (config: ConfigService) => {
        const loggers = [
          LoggerService.console({
            //   timeFormat: "HH:mm: ",
            consoleOptions: {
              level: 'info',
            },
          }),
          LoggerService.rotate({
            colorize: config.logger.colorize,
            fileOptions: {
              filename: `${config.logger.path}/${config.serviceName}-%DATE%.log`,
              level: 'info',
            },
          }),
        ];
        return new LoggerService(config.logger.logLevel, loggers);
      },
      inject: [ConfigService],
    },
  ],
  exports: [LoggerService],
})
export class LoggerModule {}
