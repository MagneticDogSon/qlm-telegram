import '../src/loadEnv.ts';
import { telegramFetch, telegramProxyHost } from '../src/telegramProxy.ts';

console.log('proxy', telegramProxyHost());
const r = await telegramFetch('https://api.telegram.org/bot0:invalid/getMe');
console.log('getMe', r.status, (await r.text()).slice(0, 200));
