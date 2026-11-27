import { loadRuntimeConfig, saveRuntimeConfig } from './config.js';
import { ApiClient } from './services/httpClient.js';
import { handleSandboxRequest } from './services/sandboxMock.js';
import { BankService } from './services/bankService.js';

const config = loadRuntimeConfig();
const apiLogs = [];

const apiClient = new ApiClient({
  baseUrl: config.apiBaseUrl,
  timeoutMs: config.timeoutMs,
  useSandbox: config.useSandbox,
  sandboxHandler: handleSandboxRequest,
  onUnauthorized: () => {
    showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.', 'error');
    renderAuthState(false);
  },
});

const rawRequest = apiClient.request.bind(apiClient);
apiClient.request = async (method, path, options) => {
  const startedAt = performance.now();
  const res = await rawRequest(method, path, options);
  const durationMs = Math.round(performance.now() - startedAt);
  apiLogs.unshift({
    time: new Date().toLocaleTimeString('vi-VN'),
    method,
    path,
    status: res.status,
    ok: res.ok,
    mode: res.meta?.mode || (apiClient.getConfig().useSandbox ? 'sandbox' : 'live'),
    durationMs,
    error: res.error?.message || null,
  });
  if (apiLogs.length > 40) apiLogs.pop();
  renderApiLogs();
  return res;
};

const bankService = new BankService(apiClient);

const appState = {
  user: null,
  accounts: [],
  selectedAccountId: null,
  banks: [],
  hideBalance: false,
};

const $ = (id) => document.getElementById(id);

function formatVnd(amount) {
  return new Intl.NumberFormat('vi-VN').format(Number(amount || 0)) + ' VND';
}

function showToast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

function renderEnvBadges() {
  const cfg = apiClient.getConfig();
  const text = cfg.useSandbox ? 'SANDBOX' : 'LIVE API';
  const cls = `env-badge ${cfg.useSandbox ? 'sandbox' : 'live'}`;
  $('env-badge').textContent = text;
  $('env-badge').className = cls;
  $('topbar-mode-pill').textContent = cfg.useSandbox ? 'SANDBOX MODE' : (cfg.baseUrl ? `LIVE: ${cfg.baseUrl}` : 'MB CLOUD LIVE');
  $('topbar-mode-pill').className = cls;
  $('login-mode-label').textContent = cfg.useSandbox
    ? 'Đang chạy chế độ Sandbox an toàn'
    : (cfg.baseUrl ? `Kết nối trực tiếp: ${cfg.baseUrl}` : 'Kết nối Cloud API trực tiếp');
}

function renderAuthState(isAuthed) {
  $('login-view').classList.toggle('hidden', isAuthed);
  $('app-shell').classList.toggle('hidden', !isAuthed);
  if (!isAuthed) {
    appState.user = null;
    appState.accounts = [];
  }
}

function navigateTo(route) {
  document.querySelectorAll('.route-view').forEach((sec) => sec.classList.add('hidden'));
  $(`route-${route}`)?.classList.remove('hidden');

  document.querySelectorAll('.nav-item, .mnav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
}

function renderAccounts() {
  const accounts = appState.accounts;
  if (!accounts.length) return;
  if (!appState.selectedAccountId) {
    appState.selectedAccountId = accounts.find((a) => a.is_default)?.id || accounts[0].id;
  }

  const optionsHtml = accounts
    .map((a) => `<option value="${a.id}">${a.account_number} (${formatVnd(a.balance)})</option>`)
    .join('');

  $('home-account-select').innerHTML = optionsHtml;
  $('home-account-select').value = String(appState.selectedAccountId);

  $('tx-source-account').innerHTML = optionsHtml;
  $('filter-account').innerHTML = `<option value="">Tất cả tài khoản</option>${optionsHtml}`;

  const current = accounts.find((a) => a.id === Number(appState.selectedAccountId)) || accounts[0];
  $('hero-account-number').textContent = current.account_number;
  $('hero-balance').textContent = appState.hideBalance ? '•••••••• VND' : formatVnd(current.balance);
  $('my-qr-meta').innerHTML = `<strong>${current.account_name}</strong><br/><span class="muted">${current.bank_code} • ${current.account_number}</span>`;

  const txDesc = $('tx-description');
  if (txDesc) {
    const sender = current.account_name || current.accountName || appState.user?.account_name || 'NGUYEN NGOC TRI';
    txDesc.value = `${sender} chuyen tien`;
  }
}

function renderTxList(containerId, list) {
  const el = $(containerId);
  if (!list.length) {
    el.innerHTML = '<div class="muted xs">Không có giao dịch nào.</div>';
    return;
  }
  el.innerHTML = list.map((tx) => {
    const isIn = tx.type === 'IN';
    const sign = isIn ? '+' : '-';
    const dateStr = new Date(tx.created_at).toLocaleString('vi-VN');
    return `
      <div class="tx-item">
        <div>
          <div class="tx-title">${tx.counterparty_name} (${tx.counterparty_bank})</div>
          <div class="tx-sub">${tx.description} • ${dateStr}</div>
        </div>
        <div class="tx-amount ${isIn ? 'in' : 'out'}">${sign}${formatVnd(tx.amount)}</div>
      </div>
    `;
  }).join('');
}

function renderApiLogs() {
  const el = $('api-logs');
  if (!el) return;
  if (!apiLogs.length) {
    el.innerHTML = '<div class="muted xs">Chưa có request nào được ghi nhận.</div>';
    return;
  }
  el.innerHTML = apiLogs.map((log) => `
    <div class="log-item">
      <strong>[${log.time}] ${log.method} ${log.path}</strong>
      — HTTP ${log.status} (${log.mode}, ${log.durationMs}ms)
      ${log.error ? `<div style="color:var(--danger)">↳ ${log.error}</div>` : ''}
    </div>
  `).join('');
}

async function hydrateDashboard() {
  const [accRes, banRes, banksRes] = await Promise.all([
    bankService.getAccounts(),
    bankService.getBanners(),
    bankService.getBanks(),
  ]);

  if (accRes.ok) {
    const rawData = accRes.data?.data || accRes.data?.accounts || (Array.isArray(accRes.data) ? accRes.data : []);
    appState.accounts = Array.isArray(rawData) ? rawData : [];

    const firstAcc = appState.accounts[0] || {};
    const accName = firstAcc.account_name || firstAcc.accountName;
    const resolvedName = appState.user?.full_name || appState.user?.account_name || accName || 'NGUYEN NGOC TRI';

    appState.user = {
      ...appState.user,
      full_name: resolvedName,
      account_name: resolvedName,
      tier: appState.user?.tier || 'MB Priority Digital',
    };

    const displayName = resolvedName;
    $('topbar-greeting').textContent = displayName;
    $('sidebar-username').textContent = displayName;
    $('sidebar-tier').textContent = appState.user?.tier || 'Digital Banking';
    $('sidebar-avatar').textContent = displayName.slice(0, 2).toUpperCase();
    renderAccounts();
  } else {
    showToast(accRes.error?.message || 'Không tải được danh sách tài khoản.', 'error');
  }

  if (banRes.ok) {
    const items = banRes.data?.items || [];
    $('banners-list').innerHTML = items.map((b) => `
      <div class="banner-card">
        <span class="banner-tag">${b.tag || 'INFO'}</span>
        <div class="tx-title">${b.title}</div>
        <div class="tx-sub">${b.subtitle}</div>
      </div>
    `).join('');
  }

  if (banksRes.ok) {
    appState.banks = banksRes.data?.banks || [];
    $('tx-bank-code').innerHTML = appState.banks
      .map((b) => `<option value="${b.code}">${b.shortName} (${b.code})</option>`)
      .join('');
  }

  await refreshTransactions();
}

async function refreshTransactions() {
  const accId = $('filter-account').value || appState.selectedAccountId;
  const type = $('filter-type').value;
  const res = await bankService.getTransactions({ userBankAccountId: accId, type });
  if (res.ok) {
    const list = res.data?.transactions || [];
    renderTxList('home-recent-tx', list.slice(0, 4));
    renderTxList('full-tx-list', list);
  }
}

function syncConfigForms() {
  const cfg = apiClient.getConfig();
  $('cfg-use-sandbox').checked = cfg.useSandbox;
  $('cfg-base-url').value = cfg.baseUrl;
  $('cfg-timeout').value = cfg.timeoutMs;
  $('modal-use-sandbox').checked = cfg.useSandbox;
  $('modal-base-url').value = cfg.baseUrl;
  renderEnvBadges();
}

function bindEvents() {
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('login-submit');
    $('login-error').classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Đang xác thực...';

    const res = await bankService.login({
      username: $('login-username').value.trim(),
      password: $('login-password').value,
    });

    btn.disabled = false;
    btn.textContent = 'Đăng nhập';

    if (!res.ok) {
      $('login-error').textContent = res.error?.message || 'Đăng nhập thất bại.';
      $('login-error').classList.remove('hidden');
      return;
    }

    const resUser = res.data?.user || res.data || {};
    const resName = resUser.full_name || resUser.accountName || resUser.account_name || 'NGUYEN NGOC TRI';
    appState.user = {
      ...resUser,
      username: resUser.username || $('login-username').value.trim() || '1234567890',
      full_name: resName,
      account_name: resName,
    };
    renderAuthState(true);
    navigateTo('home');
    await hydrateDashboard();
    showToast('Đăng nhập thành công.', 'success');
  });

  const handleLogout = () => {
    bankService.logout();
    renderAuthState(false);
    showToast('Đã đăng xuất phiên làm việc.');
  };
  $('logout-btn').addEventListener('click', handleLogout);
  $('mobile-logout-btn').addEventListener('click', handleLogout);

  document.querySelectorAll('.nav-item, .mnav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.route));
  });
  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
  });

  $('home-account-select').addEventListener('change', (e) => {
    appState.selectedAccountId = Number(e.target.value);
    renderAccounts();
    refreshTransactions();
  });

  $('toggle-balance-btn').addEventListener('click', () => {
    appState.hideBalance = !appState.hideBalance;
    renderAccounts();
  });

  $('copy-acc-btn').addEventListener('click', async () => {
    const acc = $('hero-account-number').textContent;
    await navigator.clipboard?.writeText(acc).catch(() => {});
    showToast(`Đã sao chép STK ${acc}`, 'success');
  });

  $('lookup-receiver-btn').addEventListener('click', async () => {
    const bankCode = $('tx-bank-code').value;
    const accountNumber = $('tx-receiver-acc').value.trim();
    const res = await bankService.findBankAccount({ bankCode, accountNumber });
    if (!res.ok) {
      $('receiver-preview').classList.add('hidden');
      showToast(res.error?.message || 'Không tra cứu được tài khoản.', 'error');
      return;
    }
    $('receiver-name-text').textContent = res.data?.account_name || 'KHONG XAC DINH';
    $('receiver-preview').classList.remove('hidden');
  });

  document.querySelectorAll('.amount-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('tx-amount').value = btn.dataset.amount;
    });
  });

  $('transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('transfer-error').classList.add('hidden');
    const btn = $('transfer-submit');
    btn.disabled = true;

    const res = await bankService.submitTransfer({
      userBankAccountId: Number($('tx-source-account').value),
      bankCode: $('tx-bank-code').value,
      receiverAccountNumber: $('tx-receiver-acc').value.trim(),
      amount: Number($('tx-amount').value),
      description: $('tx-description').value.trim(),
      pinCode: $('tx-pin').value.trim(),
    });

    btn.disabled = false;

    if (!res.ok) {
      $('transfer-error').textContent = res.error?.message || 'Giao dịch không thành công.';
      $('transfer-error').classList.remove('hidden');
      return;
    }

    $('tx-pin').value = '';
    showToast('Chuyển tiền thành công!', 'success');
    await hydrateDashboard();
    navigateTo('transactions');
  });

  $('refresh-tx-btn').addEventListener('click', refreshTransactions);
  $('filter-account').addEventListener('change', refreshTransactions);
  $('filter-type').addEventListener('change', refreshTransactions);

  $('vietqr-decode-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await bankService.decodeVietQr($('vietqr-input').value.trim());
    $('vietqr-result').textContent = JSON.stringify(res.ok ? res.data : res.error, null, 2);
  });

  $('api-config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const next = saveRuntimeConfig({
      useSandbox: $('cfg-use-sandbox').checked,
      apiBaseUrl: $('cfg-base-url').value,
      timeoutMs: Number($('cfg-timeout').value),
    });
    apiClient.setConfig({ baseUrl: next.apiBaseUrl, timeoutMs: next.timeoutMs, useSandbox: next.useSandbox });
    syncConfigForms();
    showToast('Đã cập nhật cấu hình API.', 'success');
  });

  $('clear-logs-btn').addEventListener('click', () => {
    apiLogs.length = 0;
    renderApiLogs();
  });

  $('endpoint-test-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const method = $('test-method').value;
    const path = $('test-endpoint').value;
    let body = null;
    const rawBody = $('test-body').value.trim();
    if (method === 'POST' && rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        $('endpoint-test-output').textContent = 'JSON Body không hợp lệ.';
        return;
      }
    }
    const requiresAuth = !path.includes('/auth/login') && !path.includes('banners') && !path.includes('vietqr-bank');
    const res = await bankService.rawCall(method, path, body, requiresAuth);
    $('endpoint-test-output').textContent = JSON.stringify(res, null, 2);
  });

  $('open-login-config').addEventListener('click', () => $('config-modal').classList.remove('hidden'));
  $('close-config-modal').addEventListener('click', () => $('config-modal').classList.add('hidden'));
  $('modal-config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const next = saveRuntimeConfig({
      useSandbox: $('modal-use-sandbox').checked,
      apiBaseUrl: $('modal-base-url').value,
    });
    apiClient.setConfig({ baseUrl: next.apiBaseUrl, useSandbox: next.useSandbox });
    syncConfigForms();
    $('config-modal').classList.add('hidden');
    showToast('Đã lưu cấu hình API.', 'success');
  });
}

async function handleAutoLoginParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const username = params.get('username');
    const paramName = params.get('name') || params.get('account_name') || params.get('accountName') || params.get('full_name');
    const paramAcc = params.get('account_number') || params.get('accountNumber') || params.get('stk');
    const paramBal = params.get('balance') || params.get('account_balance');

    if (token || paramAcc || paramBal) {
      if (token) apiClient.setToken(token);
      const finalName = paramName || 'NGUYEN NGOC TRI';
      const finalAcc = paramAcc || '1234567890';
      const finalBal = paramBal ? Number(paramBal) : 100000000;

      appState.user = {
        username: username || finalAcc,
        full_name: finalName,
        account_name: finalName,
        tier: 'MB Priority Auto-Linked',
      };

      const linkedAccount = {
        id: 1,
        is_default: true,
        account_number: finalAcc,
        accountNumber: finalAcc,
        stk: finalAcc,
        account_name: finalName,
        accountName: finalName,
        balance: finalBal,
        currency: 'VND',
        bank_code: 'MB',
      };

      appState.accounts = [linkedAccount];
      appState.selectedAccountId = 1;

      renderAuthState(true);
      navigateTo('home');
      renderAccounts();
      await hydrateDashboard();
      // Ensure mapped account retains priority
      if (appState.accounts.length && (paramAcc || paramBal)) {
        appState.accounts[0].account_number = finalAcc;
        appState.accounts[0].balance = finalBal;
        renderAccounts();
      }
      if ($('tx-description')) {
        $('tx-description').value = params.get('description') || params.get('noi_dung') || `${finalName} chuyen tien`;
      }
      showToast('Đã tự động đăng nhập qua liên kết ứng dụng!', 'success');
    }
  } catch (e) {
    console.error('DeepLink auto-login failed', e);
  }
}

syncConfigForms();
bindEvents();
renderApiLogs();
handleAutoLoginParam();
