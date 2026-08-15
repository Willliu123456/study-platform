/* ============ 学升 · 微信支付 APIv3（Native 扫码支付）对接 ============ */
/* 配置：data/wxpay.config.json
   {
     "enabled": true,
     "mchid": "1600000000",          // 商户号（10 位）
     "appid": "wx...",               // 绑定的 AppID（小程序/公众号）
     "apiv3Key": "32位密钥",          // 商户平台 → API安全 → APIv3密钥
     "certSerial": "证书序列号",       // API证书 → 查看证书序列号
     "keyPath": "apiclient_key.pem", // 商户API私钥（放到本目录或绝对路径）
     "certPath": "apiclient_cert.pem",
     "platformPubPath": "wechatpay_pub.pem", // 微信支付平台证书（验回调用）
     "notifyUrl": "https://你的域名/api/wxpay/notify"
   }
*/
'use strict';
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = process.env.XS_WXPAY_CONFIG || path.join(__dirname, '..', 'data', 'wxpay.config.json');
const API_BASE = 'https://api.mch.weixin.qq.com';

let cache = null;
function getConfig() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    cache = { enabled: false };
  }
  return cache;
}

function isEnabled() {
  const c = getConfig();
  return !!(c.enabled && c.mchid && c.appid && c.apiv3Key && c.certSerial && c.keyPath);
}

function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.join(path.dirname(CONFIG_PATH), p);
}

function getPrivKey() {
  const c = getConfig();
  return fs.readFileSync(resolvePath(c.keyPath), 'utf8');
}

/* ---------- APIv3 请求签名（RSA-SHA256） ---------- */
function buildAuth(method, urlPath, body) {
  const c = getConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString('hex');
  const msg = method + '\n' + urlPath + '\n' + timestamp + '\n' + nonce + '\n' + body + '\n';
  const signature = crypto.createSign('RSA-SHA256').update(msg).sign(getPrivKey(), 'base64');
  return 'WECHATPAY2-SHA256-RSA2048 '
    + 'mchid="' + c.mchid + '",'
    + 'nonce_str="' + nonce + '",'
    + 'signature="' + signature + '",'
    + 'timestamp="' + timestamp + '",'
    + 'serial_no="' + c.certSerial + '"';
}

function apiRequest(method, urlPath, bodyObj) {
  const body = bodyObj ? JSON.stringify(bodyObj) : '';
  return new Promise((resolve, reject) => {
    const req = https.request(API_BASE + urlPath, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: buildAuth(method, urlPath, body),
        'User-Agent': 'xs-study/1.0'
      }
    }, (res) => {
      let d = '';
      res.on('data', c => { d += c; });
      res.on('end', () => {
        let j = {};
        try { j = JSON.parse(d); } catch (e) { /* 非 JSON 响应 */ }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(j);
        const msg = (j && (j.message || j.code)) || ('微信支付请求失败 HTTP ' + res.statusCode);
        const err = new Error(msg);
        err.raw = j;
        reject(err);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/* ---------- Native 下单 → code_url ---------- */
async function createNativeOrder({ outTradeNo, desc, amountFen, notifyUrl }) {
  const c = getConfig();
  if (!isEnabled()) throw new Error('微信支付未启用，请先配置 data/wxpay.config.json');
  const data = {
    appid: c.appid,
    mchid: c.mchid,
    description: String(desc || '学升会员').slice(0, 127),
    out_trade_no: outTradeNo,
    notify_url: notifyUrl || c.notifyUrl,
    amount: { total: Math.round(amountFen), currency: 'CNY' }
  };
  const r = await apiRequest('POST', '/v3/pay/transactions/native', data);
  if (!r.code_url) throw new Error('微信下单未返回二维码：' + (r.message || JSON.stringify(r)));
  return r.code_url;
}

/* ---------- 回调验签（微信支付平台证书公钥） ---------- */
function loadPlatformPub() {
  const c = getConfig();
  if (!c.platformPubPath) return null;
  try { return fs.readFileSync(resolvePath(c.platformPubPath), 'utf8'); }
  catch (e) { return null; }
}

function verifyNotifySign(headers, rawBody) {
  const pub = loadPlatformPub();
  if (!pub) throw new Error('缺少微信支付平台证书文件（platformPubPath）');
  const signature = headers['wechatpay-signature'];
  const timestamp = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  if (!signature || !timestamp || !nonce) throw new Error('回调缺少微信签名头');
  const msg = timestamp + '\n' + nonce + '\n' + rawBody + '\n';
  const ok = crypto.createVerify('RSA-SHA256').update(msg).verify(pub, signature, 'base64');
  if (!ok) throw new Error('回调验签失败');
}

/* ---------- 回调数据解密（AES-256-GCM） ---------- */
function decryptResource(resource) {
  const c = getConfig();
  if (!resource || !resource.ciphertext) throw new Error('回调缺少 resource');
  const key = Buffer.from(c.apiv3Key, 'utf8');
  const buf = Buffer.from(resource.ciphertext, 'base64');
  const authTag = buf.slice(buf.length - 16);
  const data = buf.slice(0, buf.length - 16);
  const aad = resource.associated_data ? Buffer.from(resource.associated_data, 'utf8') : Buffer.alloc(0);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  decipher.setAAD(aad);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(out.toString('utf8'));
}

module.exports = { getConfig, isEnabled, createNativeOrder, verifyNotifySign, decryptResource };
