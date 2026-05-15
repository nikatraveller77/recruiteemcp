const express = require('express');
const app = express();
app.use(express.json());

const COMPANY_ID = '117135';
const TOKEN = process.env.RECRUITEE_TOKEN;
const PORT = process.env.PORT || 3000;

function recruitee(path, method = 'GET', body = null) {
  const url = `https://api.recruitee.com/c/${COMPANY_ID}${path}`;
  console.log(`[recruitee] ${method} ${url} | token: ${TOKEN ? TOKEN.slice(0,6)+'...' : 'MISSING'}`);
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(async r => {
    const data = await r.json();
    console.log(`[recruitee] status: ${r.status} | keys: ${Object.keys(data).join(', ')}`);
    return data;
  });
}

const TOOLS = [
  {
    name: 'get_candidates',
    description: 'Отримати список останніх кандидатів з Recruitee',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Кількість кандидатів (за замовчуванням 30)' }
      }
    }
  },
  {
    name: 'search_candidates',
    description: 'Пошук кандидатів за іменем або email',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Пошуковий запит' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_candidate',
    description: 'Отримати повні дані кандидата за ID',
    inputSchema: {
      type: 'object',
      properties: {
        candidate_id: { type: 'number', description: 'ID кандидата в Recruitee' }
      },
      required: ['candidate_id']
    }
  },
  {
    name: 'get_vacancies',
    description: 'Отримати список всіх вакансій (офферів) з Recruitee',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Кількість вакансій (за замовчуванням 50)' }
      }
    }
  },
  {
    name: 'get_candidates_by_vacancy',
    description: 'Отримати кандидатів по конкретній вакансії',
    inputSchema: {
      type: 'object',
      properties: {
        offer_id: { type: 'number', description: 'ID вакансії в Recruitee' }
      },
      required: ['offer_id']
    }
  },
  {
    name: 'add_note',
    description: 'Додати нотатку до кандидата в Recruitee',
    inputSchema: {
      type: 'object',
      properties: {
        candidate_id: { type: 'number', description: 'ID кандидата' },
        body: { type: 'string', description: 'Текст нотатки' }
      },
      required: ['candidate_id', 'body']
    }
  },
  {
    name: 'change_stage',
    description: 'Змінити етап / статус кандидата в Recruitee',
    inputSchema: {
      type: 'object',
      properties: {
        candidate_id: { type: 'number', description: 'ID кандидата' },
        status: { type: 'string', description: 'Новий статус: sourced, phone_screen, interview, offer, hired, rejected' }
      },
      required: ['candidate_id', 'status']
    }
  }
];

async function callTool(name, args) {
  switch (name) {
    case 'get_candidates': {
      const limit = args.limit || 30;
      const data = await recruitee(`/candidates?limit=${limit}&sort_by=created_at&sort_order=desc`);
      const list = (data.candidates || []).map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        status: c.status,
        stage: c.stage?.name,
        vacancy: c.position?.title || c.offer?.title,
        created_at: c.created_at
      }));
      return `Знайдено ${list.length} кандидатів:\n\n` + list.map(c =>
        `ID: ${c.id} | ${c.name || 'Без імені'} | ${c.email || ''} | Етап: ${c.stage || c.status || '—'} | Вакансія: ${c.vacancy || '—'}`
      ).join('\n');
    }

    case 'search_candidates': {
      const data = await recruitee(`/candidates?query=${encodeURIComponent(args.query)}&limit=20`);
      const list = data.candidates || [];
      if (!list.length) return 'Кандидатів не знайдено.';
      return `Знайдено ${list.length}:\n\n` + list.map(c =>
        `ID: ${c.id} | ${c.name || 'Без імені'} | ${c.email || ''} | Етап: ${c.stage?.name || c.status || '—'} | Вакансія: ${c.position?.title || c.offer?.title || '—'}`
      ).join('\n');
    }

    case 'get_candidate': {
      const data = await recruitee(`/candidates/${args.candidate_id}`);
      const c = data.candidate || data;
      const notes = (c.notes || []).map(n =>
        `  - ${n.body || n.text || ''} (${n.created_at ? new Date(n.created_at).toLocaleDateString('uk-UA') : ''}${n.author ? ' · ' + n.author.name : ''})`
      ).join('\n');
      const phone = c.phones?.[0]?.value || '—';
      const linkedin = c.links?.find(l => l.url?.includes('linkedin'))?.url || '—';
      return `Кандидат: ${c.name || 'Без імені'}
Email: ${c.email || '—'}
Телефон: ${phone}
LinkedIn: ${linkedin}
Вакансія: ${c.position?.title || c.offer?.title || '—'}
Етап: ${c.stage?.name || c.status || '—'}
Додано: ${c.created_at ? new Date(c.created_at).toLocaleDateString('uk-UA') : '—'}
Нотатки (${(c.notes || []).length}):
${notes || '  немає'}`;
    }

    case 'get_vacancies': {
      const limit = args.limit || 50;
      const data = await recruitee(`/offers?limit=${limit}`);
      const list = data.offers || [];
      if (!list.length) return 'Вакансій не знайдено.';
      return `Вакансії (${list.length}):\n\n` + list.map(v =>
        `ID: ${v.id} | ${v.title || v.name || 'Без назви'} | Статус: ${v.status || v.state || '—'} | ${v.department || ''}`
      ).join('\n');
    }

    case 'get_candidates_by_vacancy': {
      const data = await recruitee(`/offers/${args.offer_id}/candidates`);
      const list = data.candidates || [];
      if (!list.length) return 'Кандидатів по цій вакансії не знайдено.';
      return `Кандидати по вакансії (${list.length}):\n\n` + list.map(c =>
        `ID: ${c.id} | ${c.name || 'Без імені'} | ${c.email || ''} | Етап: ${c.stage?.name || c.status || '—'}`
      ).join('\n');
    }

    case 'add_note': {
      await recruitee(`/candidates/${args.candidate_id}/notes`, 'POST', { note: { body: args.body } });
      return `Нотатку додано до кандидата ID ${args.candidate_id}.`;
    }

    case 'change_stage': {
      await recruitee(`/candidates/${args.candidate_id}`, 'PATCH', { candidate: { status: args.status } });
      return `Статус кандидата ID ${args.candidate_id} змінено на "${args.status}".`;
    }

    default:
      return `Невідомий інструмент: ${name}`;
  }
}

app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body;

  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'recruitee-mcp', version: '1.0.0' }
      }
    });
  }

  if (method === 'tools/list') {
    return res.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      const result = await callTool(name, args || {});
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: result }] }
      });
    } catch (e) {
      return res.json({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: `Помилка: ${e.message}` }], isError: true }
      });
    }
  }

  res.json({ jsonrpc: '2.0', id, result: {} });
});

app.get('/health', (_, res) => res.json({ status: 'ok', company: COMPANY_ID }));

app.listen(PORT, () => console.log(`Recruitee MCP server running on port ${PORT}`));
