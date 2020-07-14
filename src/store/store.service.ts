import { Injectable } from '@nestjs/common';

@Injectable()
export class StoreService {
  async productList() {}

  async productDetail() {}

  async userOrderList() {}

  async orderInfo() {}

  async placeOrder() {}

  async refundOrder() {}

  async callbackOrder() {}
}
