import { Column, Model, Table, Index, PrimaryKey, DataType, Default, AutoIncrement } from 'sequelize-typescript';

@Table({ timestamps: false })
export class Payment extends Model<Payment> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id: number;

  @Column(DataType.BIGINT)
  payType: number;

  @Column(DataType.BIGINT)
  direction: number;

  @Column(DataType.BIGINT)
  cnyAmount: number;

  @Column(DataType.BIGINT)
  tokenAmount: number;

  @Column(DataType.BIGINT)
  token: number;

  @Column(DataType.BIGINT)
  tokenPrice: number;

  @Column(DataType.BIGINT)
  refId: number;

  @Column(DataType.BIGINT)
  refType: number;

  @Column(DataType.BIGINT)
  timestamp: number;
}
