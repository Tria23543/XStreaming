import Xal from './xal';
import TokenStore from './xal/tokenstore';
import { debugFactory } from './utils/debug';

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

  _notifyFailed(error: any) {
    this._isAuthenticating = false;
    if (this._pendingCheckResolve) {
      this._pendingCheckResolve(false);
      this._pendingCheckResolve = null;
    }
    if (this._authenticationFailed) {
      this._authenticationFailed(error);
    }
  }

  _notifyCompleted(streamingTokens: any, webToken: any) {
    this._isAuthenticating = false;
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
    return new Promise<boolean>(resolve => {
      try {
        this._tokenStore.load();
        log.info('[checkAuthentication] Starting token check...');
        log.info(
          '[checkAuthentication] hasValidAuthTokens:',
          this._tokenStore.hasValidAuthTokens(),
        );

        if (this._tokenStore.hasValidAuthTokens()) {
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
        log.error('[checkAuthentication] error:', e);
        return resolve(false);
      }
    });
  }

  /**
   * 静默刷新流程
   * 1. 如果距离上次刷新少于 1 小时，则直接获取 streaming/web token
   * 2. 否则先刷新 token 再获取
   */
  startSilentFlow() {
    log.info('[startSilentFlow] Starting silent flow...');
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
            this._notifyCompleted(streamingTokens, webToken);
          });
        })
        .catch(error => {
          log.error('[startSilentFlow] Silent flow error:', error);
          // Never clear the token store on a silent-flow failure: a
          // transient network error must not destroy a saved login. The
          // failure is surfaced so the UI can offer a fresh login instead.
          this._notifyFailed(error);
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
                this._notifyCompleted(streamingTokens, webToken);
              })
              .catch(webError => {
                log.error(
                  '[startSilentFlow] getWebToken after refresh error:',
                  webError,
                );
                this._notifyFailed(webError);
              });
          })
          .catch(streamError => {
            log.error(
              '[startSilentFlow] getStreamingToken after refresh error:',
              streamError,
            );
            this._notifyFailed(streamError);
          });
      })
      .catch(refreshError => {
        log.error('[startSilentFlow] refreshTokens failed:', refreshError);
        // Keep the saved tokens (see above): the UI offers a fresh login
        // on failure, and a successful interactive login overwrites them.
        this._notifyFailed(refreshError);
      });
  }

  /**
   * 开始交互式登录流程
   * @param redirect 数据（可能来自 App 或 WebView）
   * @param redirectUri 重定向 URI
   */
  startAuthflow(redirect: any, redirectUri: any) {
    log.info('[startAuthflow] starting interactive flow');
    this._isAuthenticating = true;

    this._xal
      .authenticateUser(this._tokenStore, redirect, redirectUri)
      .then(result => {
        log.info('[startAuthflow] authenticateUser result:', result);

        if (result) {
          // 用户成功授权 Microsoft 登录
          log.info('[startAuthflow] User authenticated, starting silent flow...');
          this.startSilentFlow();
        } else {
          // The user cancelled or dismissed the Microsoft login. Any
          // previously saved login must be kept — never clear the token
          // store here.
          log.warn(
            '[startAuthflow] Login cancelled or returned no auth code; keeping any saved login.',
          );
          this._isAuthenticating = false;
          this._notifyFailed(new Error('Login failed or cancelled'));
        }
      })
      .catch(error => {
        // A failed login attempt must not destroy a previously saved login.
        log.error('[startAuthflow] Authentication failed:', error);
        this._isAuthenticating = false;
        this._notifyFailed(error);
      });
  }
}
