import {MMKV} from 'react-native-mmkv';

export const storage = new MMKV();

// Auth tokens are sensitive, so they live in a separate encrypted MMKV
// instance. The encryption key is generated once and kept in the default
// storage; the token payload itself is never stored in plaintext.
const TOKEN_CRYPT_KEY_ID = 'tokenstore.cryptkey';

const getOrCreateCryptKey = (): string => {
  let key = storage.getString(TOKEN_CRYPT_KEY_ID);
  if (!key) {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    key = '';
    for (let i = 0; i < 16; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    storage.set(TOKEN_CRYPT_KEY_ID, key);
  }
  return key;
};

export const tokenStorage = new MMKV({
  id: 'tokenstore',
  encryptionKey: getOrCreateCryptKey(),
});
