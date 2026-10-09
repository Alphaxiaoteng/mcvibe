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
const mcpClient = new McpClient();

// 内存中维护用户的麦当劳足迹订单历史
let currentOrders: OrderRecord[] = generateRealisticOrderHistory();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API 路由
  if (pathname === '/api/vibe/summary') {
    try {
      const summary = await VibeAggregator.computeSummary(currentOrders, mcpClient);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(summary));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/vibe/record' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        
        const newRecord: OrderRecord = {
          id: `MCD-${Date.now().toString(36).toUpperCase()}`,
          timestamp: now.toISOString(),
          date: dateStr,
          items: payload.items || [
            { id: 'M01', name: '双层吉士堡', category: 'burger', count: 1, price: 21.0, calories: 450 },
            { id: 'M05', name: '鲜煮美式咖啡', category: 'drink', count: 1, price: 10.0, calories: 15 }
          ],
          totalPrice: payload.totalPrice || 31.0,
          discountAmount: payload.discountAmount || 8.5,
          paidAmount: payload.paidAmount || 22.5,
          couponUsed: payload.couponUsed || '随心配1+1优惠券',
          pointsEarned: Math.floor((payload.paidAmount || 22.5) * 10),
          diningType: payload.diningType || 'dine_in'
        };

        currentOrders.unshift(newRecord);
        const updatedSummary = await VibeAggregator.computeSummary(currentOrders, mcpClient);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, record: newRecord, summary: updatedSummary }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/vibe/token' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const token = typeof payload.token === 'string' ? payload.token.trim() : null;
        mcpClient.setToken(token);
        
        let testResult = { success: true, message: '已切换为本地沙盒演示模式' };
        if (token) {
          testResult = await mcpClient.testConnection();
        }

        const summary = await VibeAggregator.computeSummary(currentOrders, mcpClient);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: testResult.success,
          message: testResult.message,
          isSandbox: mcpClient.isUsingSandbox(),
          tokenMasked: mcpClient.getMaskedToken(),
          summary
        }));
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/vibe/reset' && req.method === 'POST') {
    currentOrders = generateRealisticOrderHistory();
    const summary = await VibeAggregator.computeSummary(currentOrders, mcpClient);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, summary }));
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

server.listen(PORT, () => {
  console.log(`[McVibe] 8-Bit Pixel Dashboard running at http://localhost:${PORT}`);
});

export { server };
