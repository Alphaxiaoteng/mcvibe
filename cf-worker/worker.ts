import { VibeAggregator } from '../src/core/vibe_aggregator.js';
import { McpClient } from '../src/core/mcp_client.js';
import { generateRealisticOrderHistory } from '../src/core/mock_data.js';

export default {
  async fetch(request: Request): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mcd-token',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    // 1. POST /api/vibe/token
    if (url.pathname === '/api/vibe/token' && request.method === 'POST') {
      try {
        const body: any = await request.json().catch(() => ({}));
        const rawToken = typeof body.token === 'string' ? body.token.trim() : '';
        const token = rawToken.replace(/^Bearer\s+/i, '').trim();

        if (!token) {
          const empty = VibeAggregator.createEmptySummary();
          return new Response(JSON.stringify({
            success: true,
            message: '已清空 Token',
            isSandbox: false,
            summary: empty
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const client = new McpClient({ token, baseUrl: 'https://mcp.mcd.cn' });
        const testRes = await client.testConnection();
        const summary = await VibeAggregator.computeSummary([], client);

        return new Response(JSON.stringify({
          success: testRes.success,
          message: testRes.message,
          isSandbox: client.isUsingSandbox(),
          tokenMasked: client.getMaskedToken(),
          summary: summary
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({
          success: false,
          message: err.message,
          isSandbox: false
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 2. GET /api/vibe/summary
    if (url.pathname === '/api/vibe/summary') {
      const isDemo = url.searchParams.get('demo') === 'true';
      if (isDemo) {
        const client = new McpClient({ forceSandbox: true });
        const orders = generateRealisticOrderHistory();
        const summary = await VibeAggregator.computeSummary(orders, client);
        return new Response(JSON.stringify(summary), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const headerToken = request.headers.get('x-mcd-token');
      const authHeader = request.headers.get('authorization');
      const queryToken = url.searchParams.get('token');
      const raw = headerToken || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) || queryToken;
      const token = raw ? raw.trim().replace(/^Bearer\s+/i, '') : null;

      if (token) {
        const client = new McpClient({ token, baseUrl: 'https://mcp.mcd.cn' });
        const summary = await VibeAggregator.computeSummary([], client);
        return new Response(JSON.stringify(summary), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const empty = VibeAggregator.createEmptySummary();
      return new Response(JSON.stringify(empty), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. 通用 MCP 反向代理 /mcp
    if (url.pathname === '/mcp') {
      const auth = request.headers.get('authorization') || request.headers.get('x-mcd-token');
      const body = await request.text();
      try {
        const mcdRes = await fetch('https://mcp.mcd.cn/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { 'Authorization': auth.startsWith('Bearer ') ? auth : `Bearer ${auth}` } : {})
          },
          body: body
        });
        const mcdText = await mcdRes.text();
        return new Response(mcdText, {
          status: mcdRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
