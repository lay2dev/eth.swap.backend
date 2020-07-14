import { Controller, Get, Query } from '@nestjs/common';
import { StoreService } from './store.service';
import { TaoquanService } from './taoquan.service';

@Controller('store')
export class StoreController {
  constructor(private readonly taoquanService: TaoquanService) {}

  @Get('productInfo')
  async getProductInfo(@Query('productId') productId: string): Promise<any> {
    // return await this.taoquanService.queryProductInventory(productId);
    /*
    {
code: 200,
data: {
name: "中杯全国通兑券",
product_id: "15001003",
stock_num: 10
},
message: "查询成功"
}


     */
    // return await this.taoquanService.queryProductDetail(productId);
    /*
   {
code: 200,
data: {
name: "中杯全国通兑券",
product_id: "15001003",
price: 1,
sell_status: 1,
card_type: 0
},
message: "查询成功"
} 
     */
    // return await this.taoquanService.placeOrder(productId, 1, 'http://127.0.0.1/shop/taoquan/callback');
    // return await this.taoquanService.placeOrder(productId, 1, 'http://127.0.0.1/shop/taoquan/callback');
    /*
    {
    "code": 200,
    "data": [
        {
            "order_no": "API1591587831796910899",
            "out_trade_no": "lay2shopxxx1591587831680",
            "product_id": "15001003",
            "unique_code": "AHKHJFDFSFDSDGFU",
            "create_time": "2020-06-08 11:43:51",
            "card_type": 0
        }
    ],
    "message": "请求通过"
  }
    */
    // return await this.taoquanService.queryOrderStatus('API1591587831796910899');
    /*
    {
code: 200,
data: 3,
message: "请求通过"
}
*/
    // return await this.taoquanService.queryOrderForAPI('lay2shopxxx1591587831680');
    /*
    {
code: 200,
data: [
{
order_no: "API1591587831796910899",
out_trade_no: "lay2shopxxx1591587831680",
product_id: "15001003",
unique_code: "AHKHJFDFSFDSDGFU",
create_time: "2020-06-08 11:43:52",
card_type: 0
}
],
message: "请求通过"
}
    */
    return await this.taoquanService.refundOrder('API1591587831796910899');
    /*
    
    */
  }
}
