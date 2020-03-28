import { Sequelize } from 'sequelize-typescript';
import { ConfigService } from '../config/config.service';
import { EthTransfer } from 'src/exchange/ethtransfer.entity';
import { PendingSwap } from 'src/exchange/pendingswap.entity';

export const databaseProviders = [
  {
    provide: 'SEQUELIZE',
    useFactory: async (config: ConfigService) => {
      const sequelize = new Sequelize({
        dialect: 'mysql',
        host: config.get('DATABASE_HOST'),
        port: Number(config.get('DATABASE_PORT')),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME'),
        logging: config.get('SEQUELIZE_ENABLE_LOGGING') === 'true',
        timezone: '+08:00',
      });
      sequelize.addModels([EthTransfer, PendingSwap]);
      await sequelize.sync({ force: true });
      return sequelize;
    },
    inject: [ConfigService],
  },
];
