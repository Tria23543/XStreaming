import {storage, tokenStorage} from '../store/mmkv';
import SisuToken from '../tokens/sisutoken';
import UserToken from '../tokens/usertoken';

const STORE_KEY = 'user.tokenstore';

export default class TokenStore {
  _userToken;
  _sisuToken;
  _tokenUpdateTime;
  // Bumped by clear() and load(): an async flow that captured the
  // revision before an await can tell that the store it meant to
  // write to has been emptied or replaced meanwhile, and must not
  // persist into it (a logout racing a silent refresh would
  // otherwise resurrect the login it just cleared).
  _revision = 0;

  getRevision() {
    return this._revision;
  }

  // Signal that an authoritative writer outside any refresh flow
  // (an interactive login) replaced the store's contents: a refresh
  // that captured the old revision must no longer persist into it.
  // (Not folded into save(): refreshTokens saves twice and would
  // invalidate its own second save.)
  invalidate() {
    this._revision += 1;
  }

  load() {
    this._revision += 1;
    let tokens = null;
    try {
      tokens = tokenStorage.getString(STORE_KEY);
    } catch {}
    if (!tokens) {
      // Migrate tokens saved by older versions in the plaintext store.
      try {
        const legacy = storage.getString(STORE_KEY);
        if (legacy) {
          tokenStorage.set(STORE_KEY, legacy);
          storage.delete(STORE_KEY);
          tokens = legacy;
        }
      } catch {}
    }
    this.loadJson(tokens || '{}');

    return true;
  }

  loadJson(json) {
    let jsonData = {};
    try {
      jsonData = JSON.parse(json);
    } catch (e) {
      // Corrupted stored data must not hang the login check; treat it as
      // "no tokens" so the user is asked to log in again.
      this._userToken = undefined;
      this._sisuToken = undefined;
      this._tokenUpdateTime = 0;
      return false;
    }

    // A stored string that parses to null/a scalar is just as unusable.
    if (!jsonData || typeof jsonData !== 'object') {
      this._userToken = undefined;
      this._sisuToken = undefined;
      this._tokenUpdateTime = 0;
      return false;
    }

    // Reset first so a reused instance never keeps tokens that the newly
    // loaded data no longer contains.
    this._userToken = undefined;
    this._sisuToken = undefined;

    if (jsonData.userToken) {
      this._userToken = new UserToken(jsonData.userToken);
    }

    if (jsonData.sisuToken) {
      this._sisuToken = new SisuToken(jsonData.sisuToken);
    }

    if (jsonData.tokenUpdateTime) {
      this._tokenUpdateTime = jsonData.tokenUpdateTime;
    } else {
      this._tokenUpdateTime = 0;
    }

    return true;
  }

  setUserToken(userToken) {
    const expireDate = new Date();
    // Coerce before adding: a string expires_in ("3600") would
    // concatenate instead (30 + "3600" -> "303600"), landing the stored
    // expiry days in the future so a dead token reads as valid.
    expireDate.setSeconds(
      expireDate.getSeconds() + (Number(userToken.data.expires_in) || 0),
    );

    if (isNaN(expireDate.getTime())) {
      // Only a non-finite/overflowing expires_in reaches this branch
      // (a missing or invalid one coerces to 0 above, stamping
      // expires_on as now — already expired, the safe direction).
      // Keep the raw data instead of throwing on toISOString(); the
      // token will simply read as expired and the refresh path will
      // handle it.
      this._userToken = new UserToken({...userToken.data});
      return;
    }

    this._userToken = new UserToken({
      ...userToken.data,
      expires_on: expireDate.toISOString(),
    });
  }

  getUserToken() {
    return this._userToken;
  }

  setSisuToken(sisuToken) {
    this._sisuToken = new SisuToken(sisuToken.data);
  }

  clearSisuToken() {
    this._sisuToken = undefined;
  }

  getSisuToken() {
    return this._sisuToken;
  }

  getTokenUpdateTime() {
    return this._tokenUpdateTime;
  }

  save(options) {
    // The intermediate save in a token refresh passes
    // {advanceUpdateTime: false}: it persists a PARTIAL refresh, and
    // stamping the update time would make the freshness check treat
    // that incomplete refresh as a completed one.
    if (!options || options.advanceUpdateTime !== false) {
      this._tokenUpdateTime = Date.now();
    }
    const data = JSON.stringify({
      userToken: this._userToken?.data,
      sisuToken: this._sisuToken?.data,
      tokenUpdateTime: this._tokenUpdateTime,
    });

    tokenStorage.set(STORE_KEY, data);
  }

  clear() {
    this._revision += 1;
    try {
      tokenStorage.delete(STORE_KEY);
    } catch (e) {
      console.log('clear error: ', e);
    }
    // Also remove any legacy plaintext copy, or it would be re-migrated
    // on the next launch and resurrect the login after a logout.
    try {
      storage.delete(STORE_KEY);
    } catch (e) {}

    this._userToken = undefined;
    this._sisuToken = undefined;
    this._tokenUpdateTime = 0;
  }

  clearTokenUpdateTime() {
    this._tokenUpdateTime = 0;
    const data = JSON.stringify({
      userToken: this._userToken?.data,
      sisuToken: this._sisuToken?.data,
      tokenUpdateTime: 0,
    });

    tokenStorage.set(STORE_KEY, data);
  }

  hasValidAuthTokens() {
    if (this._userToken) {
      if (!this._userToken.isValid()) {
        return false;
      }
    } else {
      return false;
    }

    if (this._sisuToken) {
      if (!this._sisuToken.isValid()) {
        return false;
      }
    } else {
      return false;
    }

    return true;
  }
}
