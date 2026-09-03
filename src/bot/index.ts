import '../loadEnv';
import { Bot, InlineKeyboard } from 'grammy';
import { answerFromFaq } from '../engine/matchFaq';
import { saveLaunch, runtime } from '../store';
import { grammyClientOptions, telegramProxyHost } from '../telegramProxy';

let bot: Bot | null = null;
let stopping = false;

function miniAppUrl(): string | null {
  const base = (runtime.publicUrl || '').replace(/\/$/, '');
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
    console.log('[bot] menu button set:', url);
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
  runtime.botError = '';
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
  runtime.botUsername = me.username || me.first_name;
  console.log('[bot] getMe ok @' + runtime.botUsername);

  // Set the menu button BEFORE polling so it updates even if long-poll fails.
  const menuWarning = await trySetMenuButton(instance);
  runtime.menuWarning = menuWarning || '';

  instance.catch((err) => {
    if (!stopping) console.error('[bot]', err);
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      runtime.botRunning = false;
      runtime.botError = err.message;
      reject(err);
    };
    const timer = setTimeout(() => {
      void instance.stop().catch(() => undefined);
      fail(
        new Error(
          'Polling не стартовал за 25 с (deleteWebhook/getUpdates). Проверьте TELEGRAM_PROXY — getMe мог пройти, а long poll нет.'
        )
      );
    }, 25000);
    void instance
      .start({
        onStart: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          runtime.botRunning = true;
          runtime.botError = '';
          console.log('[bot] polling');
          resolve();
        },
      })
      .catch((err) => {
        if (stopping) return;
        console.error('[bot] polling stopped:', errText(err));
        fail(err instanceof Error ? err : new Error(errText(err)));
      });
  });

  saveLaunch(runtime.botToken, runtime.publicUrl);
  return { username: runtime.botUsername, menuWarning };
}

export async function applyMenuButton(publicUrl: string): Promise<string | undefined> {
  runtime.publicUrl = publicUrl.replace(/\/$/, '');
  if (!bot) return;
  const warning = await trySetMenuButton(bot);
  runtime.menuWarning = warning || '';
  return warning;
}

/** Set the bot menu button without starting polling. Used to fix a stale menu button
 *  (e.g. a dead trycloudflare URL) even when long-polling can't reach Telegram. */
export async function setMenuButtonOnly(token: string, publicUrl: string): Promise<{ username: string; warning?: string }> {
  runtime.botToken = token.trim();
  runtime.publicUrl = publicUrl.replace(/\/$/, '');
  const clientOpts = grammyClientOptions();
  const instance = new Bot(runtime.botToken, clientOpts ? { client: clientOpts } : {});
  // setChatMenuButton first — it's a quick call (like deleteWebhook) and the whole point.
  const warning = await trySetMenuButton(instance);
  runtime.menuWarning = warning || '';
  // getMe is best-effort only (for the username display); don't fail if the proxy flakes.
  let username = '';
  try {
    const me = await instance.api.getMe();
    username = me.username || me.first_name;
    runtime.botUsername = username;
  } catch {
    /* ignore — menu button is what matters */
  }
  return { username, warning };
}
