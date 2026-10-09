import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRealisticOrderHistory } from '../core/mock_data.js';
import { VibeAggregator } from '../core/vibe_aggregator.js';
import { McpClient } from '../core/mcp_client.js';
import { OrderRecord } from '../core/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcd-token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 提取请求中的 Token (无状态透传，服务器绝对不持久化、不收集任何人的隐私凭证)
  const extractToken = (): string | null => {
    const headerToken = req.headers['x-mcd-token'];
    if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim();
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const bToken = authHeader.slice(7).trim();
      if (bToken) return bToken;
    }
    const queryToken = url.searchParams.get('token');
    if (queryToken && queryToken.trim()) return queryToken.trim();
    return null;
  };

  // API 路由
  if (pathname === '/api/vibe/summary') {
    try {
      const isDemo = url.searchParams.get('demo') === 'true';
      const token = extractToken();

      if (isDemo) {
        // 用户主动点击查看演示 Demo
        const demoOrders = generateRealisticOrderHistory();
        const demoClient = new McpClient({ forceSandbox: true });
        const summary = await VibeAggregator.computeSummary(demoOrders, demoClient);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(summary));
        return;
      }

      if (token) {
        // 用户提供了个人 Token：即时无状态调用官方 MCP 接口，不落盘、不污染全局
        const client = new McpClient({ token });
        const summary = await VibeAggregator.computeSummary([], client);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(summary));
        return;
      }

      // 默认状态：每个人打开都是完全空的！绝对不收集别人信息，无虚假数据
      const emptySummary = VibeAggregator.createEmptySummary();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(emptySummary));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/vibe/token' && req.method === 'POST') {
    let body = '';
    const MAX_BODY_BYTES = 64 * 1024;
    let exceeded = false;

    req.on('error', (err) => {
      console.warn('[HTTP Req Error]', err.message);
      if (!res.headersSent) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '请求传输异常' }));
      }
    });

    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        exceeded = true;
        req.destroy();
        if (!res.headersSent) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Payload Too Large' }));
        }
      }
    });

    req.on('end', async () => {
      if (exceeded) return;
      try {
        const payload = JSON.parse(body || '{}');
        const token = typeof payload.token === 'string' && payload.token.trim() ? payload.token.trim() : null;
        
        if (!token) {
          // 清空或空 Token：直接返回纯净空状态
          const emptySummary = VibeAggregator.createEmptySummary();
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: true,
            message: '已清空 Token，恢复为纯净空状态',
            isSandbox: false,
            summary: emptySummary
          }));
          return;
        }

        // 即时验证用户 Token
        const client = new McpClient({ token });
        const testResult = await client.testConnection();
        const summary = await VibeAggregator.computeSummary([], client);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: testResult.success,
          message: testResult.message,
          isSandbox: false,
          tokenMasked: client.getMaskedToken(),
          summary
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/vibe/auto-bind-coupons' && req.method === 'POST') {
    try {
      const token = extractToken();
      const client = new McpClient({ token: token || undefined, forceSandbox: !token });
      const bindResult = await client.callTool('auto-bind-coupons');
      const summary = token ? await VibeAggregator.computeSummary([], client) : VibeAggregator.createEmptySummary();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: true,
        bindResult,
        summary
      }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/vibe/reset' && req.method === 'POST') {
    const emptySummary = VibeAggregator.createEmptySummary();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, summary: emptySummary }));
    return;
  }

  // 静态文件服务
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }

  const ext = path.extname(filePath);
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  const contentType = mimeTypes[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

const isTestEnv = process.env.NODE_ENV === 'test' || process.argv.some(a => a.includes('test'));
if (!isTestEnv && !server.listening) {
  server.listen(PORT, () => {
    console.log(`[McVibe] 8-Bit Pixel Dashboard running at http://localhost:${PORT}`);
  });
}

export { server };
