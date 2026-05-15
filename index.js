const express = require('express');
const https = require('https');
const app = express();
app.use(express.json());

const COMPANY_ID = '117135';
const COMPANY_SUBDOMAIN = 'vpteam';
const TOKEN = process.env.RECRUITEE_TOKEN;
const PORT = process.env.PORT || 3000;

console.log('TOKEN loaded:', TOKEN ? TOKEN.slice(0, 6) + '...' : 'MISSING');

function request(hostname, path, method = 'GET', body = null, auth = true) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (auth) headers['Authorization'] = `Bearer ${TOKEN}`;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const options = { hostname, path, method, headers };
    console.log(`[${hostname}] ${method} ${path}`);
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[status: ${res.statusCode}] body: ${data.slice(0, 200)}`);
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function ats(path, method = 'GET', body = null) {
  return request('api.recruitee.com', `/c/${COMPANY_ID}${path}`, method, body, true);
}

function careers(path, method = 'GET', body = null) {
  return request(`${COMPANY_SUBDOMAIN}.recruitee.com`, `/api${path}`, method, body, false);
}

const TOOLS = [
  {
    name: 'get_candidates',
    description: 'Отримати список останніх кандидатів з Recruitee',
    inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Кількість (за замовчуванням 30)' } } }
  },
  {
    name: 'search_candidates',
    description: 'Пошук кандидатів за іменем або email',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Пошуковий запит' } }, required: ['query'] }
  },
  {
    name: 'get_candidate',
    description: 'Отримати повні дані кандидата за ID включно з нотатками',
    inputSchema: { type: 'object', properties: { candidate_id: { type: 'number', description: 'ID кандидата' } }, required: ['candidate_id'] }
  },
  {
    name: 'get_vacancies',
    description: 'Отримати список всіх вакансій з Recruitee',
    inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Кількість (за замовчуванням 50)' } } }
  },
  {
    name: 'get_candidates_by_vacancy',
    description: 'Отримати всіх кандидатів по конкретній вакансії',
    inputSchema: { type: 'object', properties: { offer_id: { type: 'number', description: 'ID вакансії' } }, required: ['offer_id'] }
  },
  {
    name: 'add_note',
    description: 'Додати нотатку до кандидата в Recruitee',
    inputSchema: { type: 'object', properties: { candidate_id: { type: 'number', description: 'ID кандидата' }, body: { type: 'string', description: 'Текст нотатки' } }, required: ['candidate_id', 'body'] }
  },
  {
    name: 'change_stage',
    description: 'Змінити етап кандидата в Recruitee',
    inputSchema: { type: 'object', properties: { candidate_id: { type: 'number', description: 'ID кандидата' }, status: { type: 'string', description: 'Новий статус: sourced, phone_screen, interview, offer, hired, rejected' } }, required: ['candidate_id', 'status'] }
  },
  {
    name: 'create_candidate',
    description: 'Створити нового кандидата і прив\'язати до вакансії через Careers Site API',
    inputSchema: { type: 'object', properties: { name: { type: 'string', description: 'Повне ім\'я' }, email: { type: 'string', description: 'Email' }, phone: { type: 'string', description: 'Телефон' }, offer_slug: { type: 'string', description: 'Slug вакансії (наприклад: ai-marketing-artist)' } }, required: ['name', 'email', 'offer_slug'] }
  }
];

async function callTool(name, args) {
  switch (name) {

    case 'get_candidates': {
      const { data } = await ats(`/candidates?limit=${args.limit || 30}&sort_by=created_at&sort_order=desc`);
      const list = data.candidates || [];
      if (!list.length) return 'Кандидатів не знайдено.';
      return `Знайдено ${list.length} кандидатів:\n\n` + list.map(c =>
        `ID: ${c.id} | ${c.name || 'Без імені'} | ${c.email || ''} | Етап: ${(c.stage && c.stage.name) || c.status || '—'} | Вакансія: ${(c.position && c.position.title) || (c.offer && c.offer.title) || '—'}`
      ).join('\n');
    }

    case 'search_candidates': {
      const { data } = await ats(`/search/new/candidates?query=${encodeURIComponent(args.query)}&limit=20`);
      const list = data.candidates || [];
      if (!list.length) return 'Кандидатів не знайдено.';
      return `Знайдено ${list.length}:\n\n` + list.map(c =>
        `ID: ${c.id} | ${c.name || 'Без імені'} | ${c.email || ''} | Етап: ${(c.stage && c.stage.name) || c.status || '—'} | Вакансія: ${(c.position && c.position.title) || (c.offer && c.offer.title) || '—'}`
      ).join('\n');
    }

    case 'get_candidate': {
      const { data } = await ats(`/candidates/${args.candidate_id}`);
      const c = data.candidate || data;
      const notes = (c.notes || []).map(n =>
        `  - ${n.body || n.text || ''} (${n.created_at ? new Date(n.created_at).toLocaleDateString('uk-UA') : ''}${n.author ? ' · ' + n.author.name : ''})`
      ).join('\n');
      const phone = (c.phones && c.phones[0] && c.phones[0].value) || (c.phones && c.phones[0]) || '—';
      const email = c.email || (c.emails && c.emails[0]) || '—';
      const linkedin = ((c.links || []).find(l => l.url && l.url.includes('linkedin')) || {}).url || '—';
      return `Кандидат: ${c.name || 'Без імені'}
Email: ${email}
Телефон: ${phone}
LinkedIn: ${linkedin}
Вакансія: ${(c.position && c.position.title) || (c.offer && c.offer.title) || '—'}
Етап: ${(c.stage && c.stage.name) || c.status || '—'}
Додано: ${c.created_at ? new Date(c.created_at).toLocaleDateString('uk-UA') : '—'}
Нотатки (${(c.notes || []).length}):
${notes || '  немає'}`;
    }

    case 'get_vacancies': {
      const { data } = await ats(`/offers?limit=${args.limit || 50}`);
      const list = data.offers || [];
      if (!list.length) return 'Вакансій не знайдено.';
      return `Вакансії (${list.length}):\n\n` + list.map(v =>
        `ID: ${v.id} | slug: ${v.slug || '—'} | ${v.title || 'Без назви'} | Статус: ${v.status || v.state || '—'}`
      ).join('\n');
    }

    case 'get_candidates_by_vacancy': {
      const { data } = await ats(`/candidates?offer_id=${args.offer_id}&limit=100`);
      const list = data.candidates || [];
      if (!list.length) return 'Кандидатів по цій вакансії не знайдено.';
      return `Кандидати по вакансії (${list.length}):\n\n` + list.map(c =>
        `ID: ${c.id} | ${c.name || 'Без імені'} | ${c.email || ''} | Етап: ${(c.stage && c.stage.name) || c.status || '—'}`
      ).join('\n');
    }

    case 'add_note': {
      const { status, data } = await ats(`/candidates/${args.candidate_id}/notes`, 'POST', { note: { body: args.body } });
      if (status !== 200 && status !== 201) return `Помилка: ${JSON.stringify(data).slice(0, 200)}`;
      return `Нотатку додано до кандидата ID ${args.candidate_id}.`;
    }

    case 'change_stage': {
      const { status, data } = await ats(`/candidates/${args.candidate_id}`, 'PATCH', { candidate: { status: args.status } });
      if (status !== 200 && status !== 201) return `Помилка: ${JSON.stringify(data).slice(0, 200)}`;
      return `Статус кандидата ID ${args.candidate_id} змінено на "${args.status}".`;
    }

    case 'create_candidate': {
      const payload = {
        candidate: {
          name: args.name,
          email: args.email,
          phone: args.phone || ''
        }
      };
      const { status, data } = await careers(`/offers/${args.offer_slug}/candidates`, 'POST', payload);
      if (status !== 200 && status !== 201) return `Помилка (${status}): ${JSON.stringify(data).slice(0, 200)}`;
      const c = data.candidate || data;
      return `Кандидата створено. ID: ${c.id} | ${c.name || args.name} | ${args.email}`;
    }

    default:
      return `Невідомий інструмент: ${name}`;
  }
}

app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;
  if (method === 'initialize') {
    return res.json({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'recruitee-mcp', version: '1.0.0' } } });
  }
  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }
  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      const result = await callTool(name, args || {});
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: result }] } });
    } catch (e) {
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Помилка: ${e.message}` }], isError: true } });
    }
  }
  res.json({ jsonrpc: '2.0', id, result: {} });
});

app.get('/health', (_, res) => res.json({ status: 'ok', company: COMPANY_ID }));
app.listen(PORT, () => console.log(`Recruitee MCP server running on port ${PORT}`));
