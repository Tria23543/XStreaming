import Xal from './xal';
import TokenStore from './xal/tokenstore';
import { debugFactory } from './utils/debug';
import {
  setLastAuthError,
  clearLastAuthError,
} from './utils/authError';

const log = debugFactory('Authentication.ts');

export default class Authentication {
  _xal: Xal;
  _tokenStore: TokenStore;
  _isAuthenticating: boolean = false;
  _authenticationCompleted: any;
  _authenticationFailed: any;

  constructor(authenticationCompleted: any, authenticationFailed?: any) {
    this._tokenStore = new TokenStore();
    this._xal = new Xal();
    this._authenticationCompleted = authenticationCompleted;
    this._authenticationFailed = authenticationFailed;
  }

  _pendingCheckResolve: ((value: boolean) => void) | null = null;

  // Single-flight bookkeeping. Without it, two overlapping checks could
  // run duelling silent flows: the second overwrote the first check's
  // resolver (whose promise then never settled), and two refreshTokens
  // calls raced on the same stored refresh token — Microsoft rotates
  // refresh tokens on use, so one flow could fail purely because the
  // other redeemed it first, and its failure notification could fire the
  // login prompt even when the other flow succeeded. Each flow now gets
  // a generation number; only the newest generation may notify.
  _inflightCheck: Promise<boolean> | null = null;
  _flowGeneration: number = 0;
  _flowRunning: number = 0;

  _notifyFailed(error: any, generation?: number) {
    if (generation !== undefined && generation !== this._flowGeneration) {
      // A superseded flow finished late: its outcome no longer counts.
      return;
    }
    // Keep the failure readable in the UI (the Cloud tab shows it):
    // a sign-in that fails silently cannot be told apart from one
    // that never ran.
    setLastAuthError(error);
    this._isAuthenticating = false;
    this._flowRunning = 0;
    this._inflightCheck = null;
    if (this._pendingCheckResolve) {
      this._pendingCheckResolve(false);
      this._pendingCheckResolve = null;
    }
    if (this._authenticationFailed) {
      this._authenticationFailed(error);
    }
  }

  _notifyCompleted(streamingTokens: any, webToken: any, generation?: number) {
    if (generation !== undefined && generation !== this._flowGeneration) {
      return;
    }
    clearLastAuthError();
    this._isAuthenticating = false;
    this._flowRunning = 0;
    this._inflightCheck = null;
    if (this._pendingCheckResolve) {
      this._pendingCheckResolve(true);
      this._pendingCheckResolve = null;
    }
    this._authenticationCompleted(streamingTokens, webToken);
  }

  /**
   * 检查当前是否已经有有效 Token
   * 如果已过期但有 userToken -> 尝试静默刷新
   */
  checkAuthentication() {
    // Single-flight: a check that arrives while another check's flow is
    // still running joins that same promise instead of starting a
    // second, competing flow.
    if (this._inflightCheck) {
      return this._inflightCheck;
    }
    const promise = new Promise<boolean>(resolve => {
      try {
        if (this._flowRunning !== 0) {
          // A flow is already running on the store — including a
          // forced post-login flow, which never registers
          // _inflightCheck, so this check could not join it above.
          // Loading here would reload the store from disk underneath
          // that flow: the reload bumps the token revision (making
          // the flow skip its saves, so a just-rotated refresh token
          // would be lost) and wipes the in-memory tokens the flow
          // is using. Join the flow instead: its completion resolves
          // this check through the notify path, and registering the
          // resolver makes this promise the in-flight check below.
          this._pendingCheckResolve = resolve;
          return;
        }
        this._tokenStore.load();
        log.info('[checkAuthentication] Starting token check...');
        const hasValidAuthTokens = this._tokenStore.hasValidAuthTokens();
        log.info(
          '[checkAuthentication] hasValidAuthTokens:',
          hasValidAuthTokens,
        );

        if (hasValidAuthTokens) {
          log.info('[checkAuthentication] Tokens are valid.');
          // Resolve from the silent flow's actual outcome (via
          // _notifyCompleted/_notifyFailed), not before it is known.
          this._pendingCheckResolve = resolve;
          this.startSilentFlow();
          return;
        }

        if (this._tokenStore.getUserToken() !== undefined) {
          log.info(
            '[checkAuthentication] Tokens are expired but user token exists. Attempting refresh...',
          );
          this._pendingCheckResolve = resolve;
          this.startSilentFlow();
          return;
        }

        log.info('[checkAuthentication] No tokens are present.');
        return resolve(false);
      } catch (e) {
        log.error('[checkAuthentication] error:', (e && e.message) || e);
        // Clear the registered resolver before resolving: if the
        // throw came from startSilentFlow() AFTER the resolver was
        // registered, leaving it set would make the code below store
        // this already-resolved false promise as the in-flight
        // check, and every later check would return that stale
        // false forever.
        this._pendingCheckResolve = null;
        return resolve(false);
      }
    });
    // Track the promise only when a flow was actually started (the
    // resolver was registered); an immediately-resolved check leaves
    // nothing in flight.
    if (this._pendingCheckResolve) {
      this._inflightCheck = promise;
    }
    return promise;
  }

  /**
   * 静默刷新流程
   * 1. 如果距离上次刷新少于 1 小时，则直接获取 streaming/web token
   * 2. 否则先刷新 token 再获取
   */
  startSilentFlow(force: boolean = false) {
    if (this._flowRunning !== 0 && !force) {
      // A flow is already running; its completion will resolve any
      // pending check and fire the callbacks. Starting another one
      // would race it on the same stored refresh token.
      log.info('[startSilentFlow] A flow is already running; joining it.');
      return;
    }
    log.info('[startSilentFlow] Starting silent flow...');
    const generation = ++this._flowGeneration;
    this._flowRunning = generation;
    this._isAuthenticating = true;

    const oneHour = 60 * 60 * 1000;
    const timeSinceUpdate = Date.now() - this._tokenStore.getTokenUpdateTime();

    // Skipping the refresh is only safe when a usable Sisu token already
    // exists: it is created exclusively by refreshTokens, and the streaming
    // token request throws without one. A fresh interactive login saves
    // only a user token (with a fresh update timestamp), so the timestamp
    // alone must never skip the refresh.
    const sisuToken = this._tokenStore.getSisuToken();
    const hasUsableSisu = !!sisuToken && sisuToken.isValid();

    if (timeSinceUpdate < oneHour && hasUsableSisu) {
      log.info('[startSilentFlow] Skipping refreshTokens');
      this._xal
        .getStreamingToken(this._tokenStore)
        .then(streamingTokens => {
          return this._xal.getWebToken(this._tokenStore).then(webToken => {
            this._notifyCompleted(streamingTokens, webToken, generation);
          });
        })
        .catch(error => {
          // Log messages only, never whole error objects: an axios
          // error carries its request config (payload + auth header),
          // which for these calls means live tokens.
          log.error('[startSilentFlow] Silent flow error:', (error && error.message) || error);
          // Never clear the token store on a silent-flow failure: a
          // transient network error must not destroy a saved login. The
          // failure is surfaced so the UI can offer a fresh login instead.
          this._notifyFailed(error, generation);
        });
      return;
    }

    // 超过 1 小时 -> 调用刷新 logic
    this._xal
      .refreshTokens(this._tokenStore)
      .then(() => {
        log.info('[startSilentFlow] Tokens have been refreshed');

        this._xal
          .getStreamingToken(this._tokenStore)
          .then(streamingTokens => {
            this._xal
              .getWebToken(this._tokenStore)
              .then(webToken => {
                this._notifyCompleted(streamingTokens, webToken, generation);
              })
              .catch(webError => {
                log.error(
                  '[startSilentFlow] getWebToken after refresh error:',
                  (webError && webError.message) || webError,
                );
                this._notifyFailed(webError, generation);
              });
          })
          .catch(streamError => {
            log.error(
              '[startSilentFlow] getStreamingToken after refresh error:',
              (streamError && streamError.message) || streamError,
            );
            this._notifyFailed(streamError, generation);
          });
      })
      .catch(refreshError => {
        log.error('[startSilentFlow] refreshTokens failed:', (refreshError && refreshError.message) || refreshError);
        // Keep the saved tokens (see above): the UI offers a fresh login
        // on failure, and a successful interactive login overwrites them.
        this._notifyFailed(refreshError, generation);
      });
  }

  /**
   * 开始交互式登录流程
   * @param redirect 数据（可能来自 App 或 WebView）
   * @param redirectUri 重定向 URI
   */
  startAuthflow(redirect: any, redirectUri: any) {
    log.info('[startAuthflow] starting interactive flow');
    // An explicit interactive login supersedes any silent flow still in
    // flight: bump the generation so the old flow's late completion is
    // ignored, and take over the running slot.
    const generation = ++this._flowGeneration;
    this._flowRunning = generation;
    this._isAuthenticating = true;

    this._xal
      .authenticateUser(this._tokenStore, redirect, redirectUri)
      .then(result => {
        log.info('[startAuthflow] authenticateUser result:', result);

        if (result) {
          // 用户成功授权 Microsoft 登录
          log.info('[startAuthflow] User authenticated, starting silent flow...');
          this.startSilentFlow(true);
        } else {
          // The user cancelled or dismissed the Microsoft login. Any
          // previously saved login must be kept — never clear the token
          // store here.
          log.warn(
            '[startAuthflow] Login cancelled or returned no auth code; keeping any saved login.',
          );
          this._notifyFailed(
            new Error(
              'Sign-in returned no authorisation code (cancelled at Microsoft, an error reply, or a state mismatch)',
            ),
            generation,
          );
        }
      })
      .catch(error => {
        // A failed login attempt must not destroy a previously saved login.
        log.error('[startAuthflow] Authentication failed:', (error && error.message) || error);
        this._notifyFailed(error, generation);
      });
  }
}
