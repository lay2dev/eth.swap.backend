import {
  Column,
  Model,
  Table,
  Index,
  PrimaryKey,
  DataType,
  Default,
  AutoIncrement,
} from 'sequelize-typescript';

@Table({})
export class EthTransfer extends Model<EthTransfer> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column(DataType.STRING)
  txhash: string;

  @Column(DataType.INTEGER)
  block: number;

  @Index
  @Column(DataType.STRING)
  from: string;

  @Column(DataType.STRING)
  to: string;

  @Column(DataType.STRING)
  currency: string;

  @Column(DataType.DECIMAL(60, 0))
  amount: number;

  @Column(DataType.INTEGER)
  confirmations: number;

  @Column(DataType.BIGINT)
  transferTime: number;

  @Column(DataType.DECIMAL(50, 10))
  currencyPrice: number;

  @Column(DataType.DECIMAL(50, 10))
  ckbPrice: number;

  @Column(DataType.DECIMAL(60, 0))
  ckbAmount: number;

  @Column(DataType.INTEGER)
  status: number;

  @Column(DataType.STRING)
  ckbTxHash: string;
}
