import { HmacSHA256, enc } from 'crypto-js';
import * as moment from 'moment';

function sign_sha(method, baseurl, path, data, apiSecret) {
  const pars = [];
  // tslint:disable-next-line: forin
  for (const item in data) {
    pars.push(item + '=' + encodeURIComponent(data[item]));
  }
  let p = pars.sort().join('&');
  const meta = [method, baseurl, path, p].join('\n');
  // console.log(meta);
  const hash = HmacSHA256(meta, apiSecret);
  const Signature = enc.Base64.stringify(hash);
  // console.log(`Signature: ${Signature}`);
  // p += `&Signature=${Signature}`;
  // console.log(p);
  // return p;
  return Signature;
}

function get_body(apiKey) {
  return {
    accessKey: apiKey,
    signatureMethod: 'HmacSHA256',
    signatureVersion: '2.1',
    timestamp: moment.utc().format('YYYY-MM-DDTHH:mm:ss'),
  };
}

export function authHuobiWS(apiKey, apiSecret) {
  const authType = 'api';

  const body = get_body(apiKey);
  const signature = sign_sha('GET', 'api.huobi.pro', '/ws/v2', body, apiSecret);
  return Object.assign(body, { authType, signature });
}
