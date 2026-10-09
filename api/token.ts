import { VibeAggregator } from '../src/core/vibe_aggregator.js';
import { McpClient } from '../src/core/mcp_client.js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-mcd-token');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const token = typeof req.body?.token === 'string' && req.body.token.trim() ? req.body.token.trim() : null;

  if (!token) {
    const emptySummary = VibeAggregator.createEmptySummary();
    res.status(200).json({
      success: true,
      message: '已清空 Token，恢复为纯净空状态',
      isSandbox: false,
      summary: emptySummary
    });
    return;
  }

  const client = new McpClient({ token });
  const testResult = await client.testConnection();
  const summary = await VibeAggregator.computeSummary([], client);

  res.status(200).json({
    success: testResult.success,
    message: testResult.message,
    isSandbox: false,
    tokenMasked: client.getMaskedToken(),
    summary
  });
}
