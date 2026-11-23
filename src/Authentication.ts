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

  _notifyFailed(error: any) {
    this._isAuthenticating = false;
    if (this._authenticationFailed) {
      this._authenticationFailed(error);
    }
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
          this.startSilentFlow();
          return resolve(true);
        }

        if (this._tokenStore.getUserToken() !== undefined) {
          log.info(
            '[checkAuthentication] Tokens are expired but user token exists. Attempting refresh...',
          );
          this.startSilentFlow();
          return resolve(true);
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

    // 小于 1 小时就不重复调用 refreshTokens
    if (timeSinceUpdate < oneHour) {
      log.info('[startSilentFlow] Skipping refreshTokens');
      this._xal
        .getStreamingToken(this._tokenStore)
        .then(streamingTokens => {
          return this._xal.getWebToken(this._tokenStore).then(webToken => {
            this._isAuthenticating = false;
            this._authenticationCompleted(streamingTokens, webToken);
          });
        })
        .catch(error => {
          log.error('[startSilentFlow] Silent flow error:', error);
          // 失败时清空 TokenStore 让前端重新触发完整登录流程
          this._tokenStore.clear();
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
                this._isAuthenticating = false;
                this._authenticationCompleted(streamingTokens, webToken);
              })
              .catch(webError => {
                log.error(
                  '[startSilentFlow] getWebToken after refresh error:',
                  webError,
                );
                this._tokenStore.clear();
                this._notifyFailed(webError);
              });
          })
          .catch(streamError => {
            log.error(
              '[startSilentFlow] getStreamingToken after refresh error:',
              streamError,
            );
            this._tokenStore.clear();
            this._notifyFailed(streamError);
          });
      })
      .catch(refreshError => {
        log.error('[startSilentFlow] refreshTokens failed:', refreshError);
        // 清除可能的无效 token 让前端重新发起登录
        this._tokenStore.clear();
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
          this._notifyFailed(new Error('Login cancelled'));
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
