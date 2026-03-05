# MARY Figma Bridge

WebSocket сервер-посредник между Claude и Figma плагином.

## Деплой на Railway (5 минут)

1. Зайди на https://railway.app и залогинься через GitHub
2. New Project → Deploy from GitHub repo
3. Загрузи папку `server` (server.js + package.json + railway.toml)
4. В настройках проекта добавь переменную окружения:
   ```
   BRIDGE_SECRET=придумай-любой-пароль-123
   ```
5. Railway даст тебе URL вида: `https://mary-bridge-xxx.railway.app`

## Установка плагина

1. В Фигме: Menu → Plugins → Development → Import from manifest
2. Выбери файл `plugin/manifest.json`
3. Запусти плагин, вставь WSS URL: `wss://mary-bridge-xxx.railway.app`
4. Нажми Connect — статус станет Live 🟢

## Готово!

Теперь пиши Claude что добавить в Фигму — он сам отправит код через сервер.
