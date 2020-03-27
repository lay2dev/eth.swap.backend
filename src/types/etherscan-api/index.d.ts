declare module 'etherscan-api' {
  export interface Transaction {
    blockNumber: string;
    timestamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    isError: string;
    txreceipt_status: string;
    input: string;
    contractAddress: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    confirmations: string;
  }

  export interface TokenTransaction {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    from: string;
    contractAddress: string;
    to: string;
    value: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimal: string;
    transactionIndex: string;
    gas: string;
    gasPrice: string;
    gasUsed: string;
    cumulativeGasUsed: string;
    input: string;
    confirmations: string;
  }

  export interface Response<T> {
    status: string;
    message: string;
    result: T;
  }

  export interface Account {
    tokenbalance(address: string, tokenname: string, contractaddress: string);
    balance(address: string): Response<string>;
    txlist(
      address: string,
      startblock?: number,
      endblock?: number,
      page?: number,
      offset?: number,
      sort?: 'asc' | 'desc',
    ): Response<Transaction[]>;
    tokentx(
      address: string,
      contractaddress: string,
      startblock?: number,
      endblock?: number,
      page?: number,
      offset?: number,
      sort?: 'asc' | 'desc',
    ): Response<TokenTransaction[]>;
  }

  export interface ProxyResponse<T> {
    jsonrpc: string;
    id: string;
    result: T;
  }

  export interface Proxy {
    eth_blockNumber(): ProxyResponse<string>;
  }

  export interface EtherscanApi {
    account: Account;
    proxy: Proxy;
  }

  export function init(
    apiKey: string,
    chain?: string,
    timeout?: number,
  ): EtherscanApi;
}
