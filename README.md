# Recruitee MCP Server

MCP-сервер для роботи з Recruitee ATS напряму з Claude.

## Деплой на Railway

1. Завантаж папку на GitHub (новий репозиторій)
2. Зайди на railway.app → New Project → Deploy from GitHub repo
3. Вибери репозиторій
4. В Settings → Variables додай:
   - `RECRUITEE_TOKEN` = твій Recruitee API token
5. Railway автоматично задеплоїть і дасть URL типу `https://recruitee-mcp-production.up.railway.app`

## Підключення до Claude

В Claude.ai → Settings → Connections → Add MCP Server:
- Name: Recruitee
- URL: `https://твій-url.up.railway.app/mcp`

## Інструменти

- `get_candidates` — останні кандидати
- `search_candidates` — пошук за іменем/email
- `get_candidate` — повні дані кандидата
- `get_vacancies` — всі вакансії
- `get_candidates_by_vacancy` — кандидати по вакансії
- `add_note` — додати нотатку
- `change_stage` — змінити етап
