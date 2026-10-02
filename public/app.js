// Razorpay Agent Studio Merchant Connector Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const mcpToolSelect = document.getElementById('mcpToolSelect');
  const toolPayload = document.getElementById('toolPayload');
  const btnRunTool = document.getElementById('btnRunTool');
  const toolOutput = document.getElementById('toolOutput');
  const execMeta = document.getElementById('execMeta');

  const btnPresetPaid = document.getElementById('btnPresetPaid');
  const btnPresetLowStock = document.getElementById('btnPresetLowStock');

  const statOrdersCount = document.getElementById('statOrdersCount');
  const statInventoryCount = document.getElementById('statInventoryCount');
  const statTokens = document.getElementById('statTokens');
  const tokenProgressFill = document.getElementById('tokenProgressFill');
  const statCircuit = document.getElementById('statCircuit');
  const authModeBadge = document.getElementById('authModeBadge');

  const tabAuth = document.getElementById('tabAuth');
  const tabRate = document.getElementById('tabRate');
  const tabSchema = document.getElementById('tabSchema');
  const authContent = document.getElementById('authContent');
  const rateContent = document.getElementById('rateContent');
  const schemaContent = document.getElementById('schemaContent');

  const authTypeSelect = document.getElementById('authTypeSelect');
  const btnValidateAuth = document.getElementById('btnValidateAuth');
  const authValidationStatus = document.getElementById('authValidationStatus');
  const schemaBox = document.getElementById('schemaBox');
  const btnSimulateBurst = document.getElementById('btnSimulateBurst');

  // Payload Presets
  const PAYLOAD_PRESETS = {
    woocommerce_list_orders: JSON.stringify({ status: "processing", limit: 5 }, null, 2),
    woocommerce_get_order: JSON.stringify({ orderId: "ord_1001" }, null, 2),
    woocommerce_search_orders: JSON.stringify({ query: "pay_Pz9K7jL1wE4m2v" }, null, 2),
    woocommerce_list_inventory: JSON.stringify({ stockStatus: "instock", limit: 5 }, null, 2),
    woocommerce_get_product: JSON.stringify({ productIdOrSku: "RZP-SND-01" }, null, 2),
    woocommerce_search_inventory: JSON.stringify({ query: "POS" }, null, 2),
    merchant_list_tickets: JSON.stringify({ status: "open" }, null, 2),
    merchant_get_ticket: JSON.stringify({ ticketId: "tkt_7001" }, null, 2),
    merchant_search_tickets: JSON.stringify({ query: "Soundbox" }, null, 2)
  };

  // Tool Select Change Handler
  mcpToolSelect.addEventListener('change', () => {
    const selected = mcpToolSelect.value;
    if (PAYLOAD_PRESETS[selected]) {
      toolPayload.value = PAYLOAD_PRESETS[selected];
    }
  });

  // Execute MCP Tool
  btnRunTool.addEventListener('click', async () => {
    const toolName = mcpToolSelect.value;
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(toolPayload.value);
    } catch (e) {
      toolOutput.textContent = 'Invalid JSON payload: ' + e.message;
      toolOutput.style.color = '#ef4444';
      return;
    }

    toolOutput.textContent = 'Executing tool via MCP...';
    toolOutput.style.color = '#38bdf8';

    const startTime = performance.now();

    try {
      const res = await fetch('/api/mcp/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, arguments: parsedArgs })
      });
      const data = await res.json();
      const elapsed = Math.round(performance.now() - startTime);

      toolOutput.textContent = JSON.stringify(data, null, 2);
      toolOutput.style.color = '#38bdf8';

      // Update meta & rate metrics
      fetchStatus();
      execMeta.textContent = `${elapsed}ms | Token Remaining: ${data.metadata?.rateLimitRemaining ?? 14.0}`;
    } catch (err) {
      toolOutput.textContent = 'Error executing MCP tool: ' + err.message;
      toolOutput.style.color = '#ef4444';
    }
  });

  // Presets
  btnPresetPaid.addEventListener('click', () => {
    mcpToolSelect.value = 'woocommerce_list_orders';
    toolPayload.value = JSON.stringify({ razorpayStatus: "unpaid" }, null, 2);
    btnRunTool.click();
  });

  btnPresetLowStock.addEventListener('click', () => {
    mcpToolSelect.value = 'woocommerce_list_inventory';
    toolPayload.value = JSON.stringify({ lowStockOnly: true }, null, 2);
    btnRunTool.click();
  });

  // Tabs
  tabAuth.addEventListener('click', () => setTab('auth'));
  tabRate.addEventListener('click', () => setTab('rate'));
  tabSchema.addEventListener('click', () => setTab('schema'));

  function setTab(tab) {
    [tabAuth, tabRate, tabSchema].forEach(t => t.classList.remove('active'));
    [authContent, rateContent, schemaContent].forEach(c => c.style.display = 'none');

    if (tab === 'auth') {
      tabAuth.classList.add('active');
      authContent.style.display = 'block';
    } else if (tab === 'rate') {
      tabRate.classList.add('active');
      rateContent.style.display = 'block';
    } else if (tab === 'schema') {
      tabSchema.classList.add('active');
      schemaContent.style.display = 'block';
      fetchSchema();
    }
  }

  // Auth Validation
  btnValidateAuth.addEventListener('click', async () => {
    const type = authTypeSelect.value;
    const storeUrl = document.getElementById('storeUrlInput').value;
    const consumerKey = document.getElementById('ckInput').value;
    const consumerSecret = document.getElementById('csInput').value;

    authValidationStatus.textContent = 'Validating credentials...';
    try {
      const res = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          storeUrl,
          credentials: { consumerKey, consumerSecret, clientId: 'client_xyz', clientSecret: 'sec_xyz' }
        })
      });
      const result = await res.json();
      authValidationStatus.textContent = JSON.stringify(result, null, 2);
      authModeBadge.innerHTML = `<span class="tag tag-blue">${type === 'api_key' ? 'API-Key (HMAC)' : 'OAuth 2.0'}</span>`;
    } catch (e) {
      authValidationStatus.textContent = 'Validation error: ' + e.message;
    }
  });

  // Burst Test
  btnSimulateBurst.addEventListener('click', async () => {
    btnSimulateBurst.disabled = true;
    btnSimulateBurst.textContent = 'Simulating 10 rapid calls...';

    for (let i = 0; i < 10; i++) {
      await fetch('/api/mcp/tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'woocommerce_list_orders', arguments: { limit: 1 } })
      });
      fetchStatus();
    }

    btnSimulateBurst.disabled = false;
    btnSimulateBurst.textContent = 'Simulate Rapid 10 Requests Burst';
  });

  // Fetch Status Metrics
  async function fetchStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      statOrdersCount.textContent = data.ordersTotal || 5;
      statInventoryCount.textContent = data.inventoryTotal || 5;
      
      const tokens = data.rateLimiter?.tokensRemaining ?? 15;
      statTokens.textContent = `${tokens} / ${data.rateLimiter?.maxTokens || 15}`;
      const percentage = Math.max(0, Math.min(100, (tokens / (data.rateLimiter?.maxTokens || 15)) * 100));
      tokenProgressFill.style.width = percentage + '%';

      statCircuit.textContent = data.rateLimiter?.circuitBreakerStatus || 'CLOSED';
    } catch (e) {
      console.error('Failed to fetch status:', e);
    }
  }

  // Fetch Tools Schema
  async function fetchSchema() {
    try {
      const res = await fetch('/api/mcp/tools');
      const data = await res.json();
      schemaBox.textContent = JSON.stringify(data, null, 2);
    } catch (e) {
      schemaBox.textContent = 'Failed to load MCP tool schema';
    }
  }

  // Initial load
  fetchStatus();
  setInterval(fetchStatus, 3000);
});
