/**
 * MB Bank Lookup Beneficiary API (Mirroring find_bank)
 * SINGLE SOURCE OF TRUTH: Firebase Realtime Database
 */

import findBankHandler from './app/find_bank.js';

export default async function handler(req, res) {
  return findBankHandler(req, res);
}
