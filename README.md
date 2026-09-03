# QLM Telegram Mini App

Соседний проект к Plugin_OCC/qlm: история Telegram-канала → пакет `.qlm/2` → бот и Mini App. Чат визуально как в основном QLM. Ответы только через FAQ (`matchFaqItem`), без LLM.

Mini App публикуется на **GitHub Pages** (HTTPS для Telegram). Бот крутится локально (polling + прокси Bot API). Cloudflare Tunnel не нужен.

## Минимум действий

1. Создайте бота в [@BotFather](https://t.me/BotFather) и скопируйте токен.
2. `npm install` и `npm run dev` — мастер на http://127.0.0.1:3000 (API на :8787).
3. Перетащите zip/JSON экспорта Telegram Desktop **или** войдите по телефону и вставьте `@channel`.
4. Вставьте токен, проверьте URL Pages и нажмите «Запустить Mini App».

После деплоя чат: https://magneticdogson.github.io/qlm-telegram/

Если обновили FAQ, снова импортируйте канал (файл `public/qlm-package.json`) и запушьте `main` — Actions пересоберёт Pages.

## Экспорт Desktop

Telegram → канал → три точки → Export chat history → JSON. Лимит сборки — 500 текстовых постов.

## Скачивание по ссылке

Одноразовый вход GramJS (телефон + код, сессия в `data/telegram.session`). Для своего `api_id`/`api_hash` задайте `TELEGRAM_API_ID` и `TELEGRAM_API_HASH`.
