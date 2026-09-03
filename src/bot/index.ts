import '../loadEnv';
import { Bot, InlineKeyboard } from 'grammy';
import { answerFromFaq } from '../engine/matchFaq';
import { runtime } from '../store';
import { grammyClientOptions, telegramProxyHost } from '../telegramProxy';

let bot: Bot | null = null;
let stopping = false;

function miniAppUrl(): string | null {
  const base = (runtime.publicUrl || runtime.tunnelUrl || '').replace(/\/$/, '');
  if (!base) return null;
  if (/github\.io/i.test(base)) return `${base}/`;
  return `${base}/app`;
}

function errText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function trySetMenuButton(instance: Bot): Promise<string | undefined> {
  const url = miniAppUrl();
  if (!url) return 'Нет публичного HTTPS URL для Mini App';
  try {
    await instance.api.setChatMenuButton({
      menu_button: { type: 'web_app', text: 'Чат', web_app: { url } },
    });
    return undefined;
  } catch (err) {
    console.warn('[bot] setChatMenuButton skipped:', errText(err));
    return `Кнопка меню не поставилась (${errText(err)}). Mini App всё равно открывается командой /start.`;
  }
}

export async function stopBot() {
  if (!bot) return;
  stopping = true;
  try {
    await bot.stop();
  } catch {
    /* ignore */
  }
  bot = null;
  runtime.botRunning = false;
  stopping = false;
}

export async function startBot(token: string): Promise<{ username: string; menuWarning?: string }> {
  await stopBot();
  runtime.botToken = token.trim();
  runtime.menuWarning = '';
  const clientOpts = grammyClientOptions();
  console.log('[bot] Telegram proxy:', telegramProxyHost() || 'off');
  const instance = new Bot(runtime.botToken, clientOpts ? { client: clientOpts } : {});
  bot = instance;

  instance.command('start', async (ctx) => {
    const url = miniAppUrl();
    if (!url) {
      await ctx.reply('Mini App ещё не опубликован. Укажите URL GitHub Pages в мастере и нажмите запуск.');
      return;
    }
    await ctx.reply(`Чат по каналу «${runtime.title || 'QLM'}». Ответы только из истории постов, без нейросети.`, {
      reply_markup: new InlineKeyboard().webApp('Открыть чат', url),
    });
  });

  instance.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    const result = answerFromFaq(ctx.message.text, runtime.context);
    await ctx.reply(result.content.slice(0, 4000));
  });

  const me = await instance.api.getMe();

  instance.catch((err) => {
    if (!stopping) console.error('[bot]', err);
  });

  void instance.start({
    onStart: () => {
      runtime.botRunning = true;
    },
  });

  await new Promise((r) => setTimeout(r, 500));
  const menuWarning = await trySetMenuButton(instance);
  runtime.menuWarning = menuWarning || '';
  return { username: me.username || me.first_name, menuWarning };
}

export async function applyMenuButton(publicUrl: string): Promise<string | undefined> {
  runtime.publicUrl = publicUrl.replace(/\/$/, '');
  if (!bot) return;
  const warning = await trySetMenuButton(bot);
  runtime.menuWarning = warning || '';
  return warning;
}
