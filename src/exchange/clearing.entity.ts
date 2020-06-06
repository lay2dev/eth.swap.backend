import { Column, Model, Table, Index, PrimaryKey, DataType, Default, AutoIncrement } from 'sequelize-typescript';

@Table
export class Clearing extends Model<Clearing> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id: number;

  @Column(DataType.BIGINT)
  orderId: number;

  @Column(DataType.STRING)
  symbol: string;

  @Column(DataType.STRING)
  tradePrice: string;

  @Column(DataType.STRING)
  tradeVolume: string;

  @Column(DataType.STRING)
  orderSide: string;

  @Column(DataType.STRING)
  orderType: string;

  @Column(DataType.BOOLEAN)
  aggressor: boolean;

  @Column(DataType.BIGINT)
  tradeId: number;

  @Column(DataType.BIGINT)
  tradeTime: number;

  @Column(DataType.STRING)
  transactFee: string;

  @Column(DataType.STRING)
  feeDeduct: string;

  @Column(DataType.STRING)
  feeDeductType: string;
}
