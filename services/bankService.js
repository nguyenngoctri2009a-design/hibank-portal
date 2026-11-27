import { APP_CONFIG } from '../config.js';

/**
 * Domain service layer separating UI views from HTTP transport details.
 */
export class BankService {
  #client;

  constructor(apiClient) {
    this.#client = apiClient;
  }

  async login({ username, password, useV1 = false }) {
    const endpoint = useV1 ? APP_CONFIG.endpoints.loginV1 : APP_CONFIG.endpoints.login;
    const res = await this.#client.post(endpoint, { username, password }, { requiresAuth: false });
    if (res.ok && res.data?.access_token) {
      this.#client.setToken(res.data.access_token);
    }
    return res;
  }

  logout() {
    this.#client.clearToken();
  }

  isAuthenticated() {
    return this.#client.hasToken();
  }

  getAccounts() {
    return this.#client.get(APP_CONFIG.endpoints.accounts);
  }

  getTransactions({ userBankAccountId, type = '' } = {}) {
    return this.#client.get(APP_CONFIG.endpoints.transactions, {
      params: {
        user_bank_account_id: userBankAccountId,
        type,
      },
    });
  }

  getBanks({ mbOnly = false } = {}) {
    const endpoint = mbOnly ? APP_CONFIG.endpoints.banksMb : APP_CONFIG.endpoints.banksAll;
    return this.#client.get(endpoint, { requiresAuth: false });
  }

  rawCall(method, path, body = null, requiresAuth = true) {
    return this.#client.request(method, path, { body, requiresAuth });
  }

  getBanners() {
    return this.#client.get(APP_CONFIG.endpoints.banners, { requiresAuth: false });
  }

  findBankAccount({ bankCode, accountNumber }) {
    return this.#client.post(APP_CONFIG.endpoints.findBank, {
      bank_code: bankCode,
      account_number: accountNumber,
    });
  }

  decodeVietQr(qrData) {
    return this.#client.post(APP_CONFIG.endpoints.vietQrDecode, {
      qr_data: qrData,
    });
  }

  submitTransfer({ userBankAccountId, bankCode, receiverAccountNumber, amount, description, pinCode }) {
    return this.#client.post(APP_CONFIG.endpoints.transfer, {
      user_bank_account_id: userBankAccountId,
      bank_code: bankCode,
      receiver_account_number: receiverAccountNumber,
      amount: Number(amount),
      description,
      pin_code: pinCode,
    });
  }
}
