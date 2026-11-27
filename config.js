/**
 * Centralized application & API configuration.
 * Change `apiBaseUrl` or `useSandbox` here or via the Settings panel in the UI.
 */
export const APP_CONFIG = {
  appName: 'HiBank Digital',
  version: '1.3.0-web',
  // Live API mode (set to true for offline sandbox testing).
  useSandbox: false,
  // Luôn dùng relative path '' để toàn bộ request đi qua server proxy hiện tại:
  apiBaseUrl: '',
  gatewayBaseUrl: '',
  timeoutMs: 12000,
  endpoints: {
    login: '/api/auth/login',
    loginV1: '/api/v1/mbbank/auth/login',
    accounts: '/api/app/user-bank-account',
    transactions: '/api/app/transactions',
    transactionsV1: '/api/v1/mbbank/transactions',
    findBank: '/api/app/find_bank',
    transfer: '/api/app/transfer',
    banksAll: '/api/vietqr-bank-all',
    banksMb: '/api/vietqr-bank-mb',
    vietQrDecode: '/api/vietQrDecode',
    banners: '/api/v1/mbbank/banners',
    lookup: '/api/lookup',
  },
};

const CONFIG_STORAGE_KEY = 'hibank_web_runtime_config';

export function loadRuntimeConfig() {
  try {
    sessionStorage.removeItem(CONFIG_STORAGE_KEY);
    return { ...APP_CONFIG, apiBaseUrl: '' };
  } catch {
    return { ...APP_CONFIG, apiBaseUrl: '' };
  }
}

export function saveRuntimeConfig(partial) {
  const current = loadRuntimeConfig();
  const next = {
    ...current,
    ...partial,
    apiBaseUrl: (partial.apiBaseUrl ?? current.apiBaseUrl).trim().replace(/\/+$/, ''),
  };
  sessionStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify({
    apiBaseUrl: next.apiBaseUrl,
    useSandbox: next.useSandbox,
    timeoutMs: next.timeoutMs,
  }));
  return next;
}
