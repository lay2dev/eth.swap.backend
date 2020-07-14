import { Column, Model, Table, Index, PrimaryKey, DataType, Default, AutoIncrement } from 'sequelize-typescript';

@Table({ timestamps: false })
export class Product extends Model<Product> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.BIGINT)
  id: number;

  @Column(DataType.BIGINT)
  productType: number;

  @Column(DataType.BIGINT)
  sourceProductId: number;

  @Column(DataType.BIGINT)
  name: number;

  @Column(DataType.STRING)
  thumbnail: string;

  @Column(DataType.BIGINT)
  description: number;

  @Column(DataType.BIGINT)
  price: number;

  @Column(DataType.BIGINT)
  stock: number;

  @Column(DataType.BIGINT)
  status: number;
}
