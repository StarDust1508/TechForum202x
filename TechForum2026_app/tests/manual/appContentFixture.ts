/** Local-only UI fixture. It never contacts production or sends notifications. */
import { createServer } from 'node:http';
import { DEFAULT_APP_CONTENT } from '../../src/lib/appContentStore';

let content = { ...DEFAULT_APP_CONTENT };
let status = 200;
let requests = 0;
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:53109');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-connectivity-probe');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return; }
  if (request.url === '/fixture' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 50_000) { response.writeHead(413).end(); return; }
    }
    try {
      const next = JSON.parse(body);
      content = next.reset ? { ...DEFAULT_APP_CONTENT } : { ...content, ...next.patch };
      status = next.status ?? 200;
      response.end(JSON.stringify({ ok: true, requests }));
    } catch { response.writeHead(400).end('{}'); }
    return;
  }
  if (request.url === '/api/v1/app-content') {
    requests++;
    response.writeHead(status).end(JSON.stringify(status === 200 ? content : { error: 'fixture_unavailable' }));
    return;
  }
  if (request.url === '/api/v1/auth/me') {
    response.end(JSON.stringify({ id: 'local-fixture-only', name: 'Проверка интерфейса', interestsCount: 1 }));
    return;
  }
  if (request.url === '/api/v1/health') { response.end('{"ok":true}'); return; }
  if (request.method !== 'GET') { response.writeHead(405).end('{}'); return; }
  response.end('[]');
});
server.listen(53108, '127.0.0.1', () => console.log('Local-only content fixture: http://127.0.0.1:53108'));
