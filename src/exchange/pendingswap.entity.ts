import {
  Column,
  Model,
  Table,
  Index,
  PrimaryKey,
  DataType,
  AutoIncrement,
  Unique,
} from 'sequelize-typescript';

@Table({})
export class PendingSwap extends Model<PendingSwap> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Unique
  @Column(DataType.STRING)
  txhash: string;

  @Index
  @Column(DataType.STRING)
  from: string;

  @Column(DataType.STRING)
  currency: string;

  @Column(DataType.DECIMAL(60, 0))
  amount: number;

  @Column(DataType.DECIMAL(60, 0))
  ckbAmount: number;

  @Column(DataType.INTEGER)
  status: number;
}
