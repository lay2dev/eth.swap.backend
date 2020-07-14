enum OrderStatus {
  INIT, // price locked
  CANCELLED, // payment timeout
  PAID, // user pay order with CKB
  DISPATCHED,
  FINISHED, // user spent the coupoun
  REFUNDING, // order refund
  REFUND,
}

import { Column, Model, Table, PrimaryKey, DataType, Default, AutoIncrement } from 'sequelize-typescript';

@Table({ timestamps: false })
export class StoreOrder extends Model<StoreOrder> {
  @PrimaryKey
  @Column(DataType.BIGINT)
  id: number;

  @Column(DataType.STRING)
  orderNo: string;

  @Column(DataType.BIGINT)
  productId: number;

  @Column(DataType.STRING)
  sourceOrderNo: string;

  @Column(DataType.BIGINT)
  source: number;

  @Column(DataType.BIGINT)
  sourceProductId: number;

  @Column(DataType.BIGINT)
  productNumber: number;

  @Column(DataType.STRING)
  amount: string;

  @Column(DataType.STRING)
  settleAmount: string;

  @Column(DataType.BIGINT)
  status: number;

  @Column(DataType.STRING)
  info: string;
}
