import { Column, Model, Table, Index, PrimaryKey, DataType, Default, AutoIncrement } from 'sequelize-typescript';

@Table({ timestamps: false })
export class MMOrder extends Model<MMOrder> {
  @PrimaryKey
  @Column(DataType.BIGINT)
  id: number;

  @Column(DataType.STRING)
  symbol: string;

  @Column(DataType.STRING)
  amount: string;

  @Column(DataType.BIGINT)
  canceledAt: number;

  @Column(DataType.BIGINT)
  createdAt: number;

  @Column(DataType.STRING)
  fieldAmount: string;

  @Column(DataType.STRING)
  fieldCashAmount: string;

  @Column(DataType.STRING)
  fieldFees: string;

  @Column(DataType.STRING)
  finishedAt: string;

  @Column(DataType.STRING)
  clientOrderId: string;

  @Column(DataType.STRING)
  price: string;

  @Column(DataType.STRING)
  source: string;

  @Column(DataType.STRING)
  state: string;

  @Column(DataType.STRING)
  type: string;

  @Column(DataType.STRING)
  stopPrice: string;

  @Column(DataType.STRING)
  operator: string;
}
