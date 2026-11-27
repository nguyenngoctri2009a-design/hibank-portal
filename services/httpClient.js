/**
 * Independent HTTP API Client with timeout, normalized responses,
 * in-memory token management, and 401 session-expiry handling.
 */
export class ApiClient {
  #baseUrl;
  #timeoutMs;
  #accessToken = null;
  #onUnauthorized = null;
  #sandboxHandler = null;
  #useSandbox = true;

  constructor({ baseUrl, timeoutMs = 12000, useSandbox = true, onUnauthorized = null, sandboxHandler = null }) {
    this.#baseUrl = (baseUrl || '').replace(/\/+$/, '');
    this.#timeoutMs = timeoutMs;
    this.#useSandbox = useSandbox;
    this.#onUnauthorized = onUnauthorized;
    this.#sandboxHandler = sandboxHandler;
  }

  setConfig({ baseUrl, timeoutMs, useSandbox }) {
    if (typeof baseUrl === 'string') this.#baseUrl = baseUrl.replace(/\/+$/, '');
    if (typeof timeoutMs === 'number' && timeoutMs > 0) this.#timeoutMs = timeoutMs;
    if (typeof useSandbox === 'boolean') this.#useSandbox = useSandbox;
  }

  getConfig() {
    return {
      baseUrl: this.#baseUrl,
      timeoutMs: this.#timeoutMs,
      useSandbox: this.#useSandbox,
    };
  }

  setToken(token) {
    this.#accessToken = token || null;
  }

  clearToken() {
    this.#accessToken = null;
  }

  hasToken() {
    return Boolean(this.#accessToken);
  }

  async request(method, path, { params = null, body = null, headers = {}, requiresAuth = true } = {}) {
    const query = params ? this.#buildQuery(params) : '';
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.#baseUrl}${normalizedPath}${query}`;

    if (requiresAuth && !this.#accessToken && !this.#useSandbox) {
      return this.#fail(401, 'UNAUTHORIZED', 'Phiên đăng nhập chưa được khởi tạo hoặc đã hết hạn.');
    }

    if (this.#useSandbox && typeof this.#sandboxHandler === 'function') {
      return this.#sandboxHandler({ method, path: normalizedPath, params, body, token: this.#accessToken });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);

    const reqHeaders = {
      Accept: 'application/json',
      ...headers,
    };
    if (body !== null && body !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (requiresAuth && this.#accessToken) {
      reqHeaders.Authorization = `Bearer ${this.#accessToken}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: reqHeaders,
        body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => null)
        : await response.text().catch(() => null);

      if (response.status === 401) {
        this.clearToken();
        if (typeof this.#onUnauthorized === 'function') {
          this.#onUnauthorized();
        }
        return this.#fail(401, 'SESSION_EXPIRED', payload?.message || 'Phiên đăng nhập đã hết hạn.');
      }

      if (!response.ok) {
        return this.#fail(
          response.status,
          payload?.code || `HTTP_${response.status}`,
          payload?.message || `Yêu cầu thất bại (${response.status}).`,
          payload
        );
      }

      return {
        ok: true,
        status: response.status,
        data: payload,
        error: null,
        meta: { url, method, mode: 'live' },
      };
    } catch (err) {
      if (err?.name === 'AbortError') {
        return this.#fail(408, 'TIMEOUT', `Kết nối quá thời gian (${this.#timeoutMs}ms).`);
      }
      return this.#fail(0, 'NETWORK_ERROR', err?.message || 'Không thể kết nối tới máy chủ API.');
    } finally {
      clearTimeout(timer);
    }
  }

  get(path, options = {}) {
    return this.request('GET', path, options);
  }

  post(path, body, options = {}) {
    return this.request('POST', path, { ...options, body });
  }

  #buildQuery(params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (!entries.length) return '';
    return '?' + new URLSearchParams(entries).toString();
  }

  #fail(status, code, message, raw = null) {
    return {
      ok: false,
      status,
      data: raw,
      error: { code, message },
      meta: { mode: this.#useSandbox ? 'sandbox' : 'live' },
    };
  }
}
