import { VibeAggregator } from '../src/core/vibe_aggregator.js';
import { McpClient } from '../src/core/mcp_client.js';
import { generateRealisticOrderHistory } from '../src/core/mock_data.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcd-token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const isDemo = req.query?.demo === 'true';
  const headerToken = req.headers['x-mcd-token'];
  const authHeader = req.headers['authorization'];
  const token = (typeof headerToken === 'string' && headerToken.trim() ? headerToken.trim() : null) ||
    (typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null) ||
    (typeof req.query?.token === 'string' && req.query.token.trim() ? req.query.token.trim() : null);

  if (isDemo) {
    const demoOrders = generateRealisticOrderHistory();
    const demoClient = new McpClient({ forceSandbox: true });
    const summary = await VibeAggregator.computeSummary(demoOrders, demoClient);
    res.status(200).json(summary);
    return;
  }

  if (token) {
    const client = new McpClient({ token });
    const summary = await VibeAggregator.computeSummary([], client);
    res.status(200).json(summary);
    return;
  }

  // 默认纯净空状态：每个人打开都是完全空的，绝不收集别人信息
  const emptySummary = VibeAggregator.createEmptySummary();
  res.status(200).json(emptySummary);
}
