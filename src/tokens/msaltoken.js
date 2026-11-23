import Token from './base';

// export interface IMsalToken {
//   lpt: string
//   refresh_token: string
//   user_id: string
// }

export default class MsalToken extends Token {
  data;
  _objectCreateTime;

  constructor(data) {
    super(data);
    this.data = data;
    this._objectCreateTime = Date.now();
  }

  getSecondsValid() {
    const expiresIn = Number(this.data?.expires_in);
    if (!expiresIn) {
      return 0;
    }
    return Math.floor(
      (this._objectCreateTime + expiresIn * 1000 - Date.now()) / 1000,
    );
  }

  isValid() {
    return this.getSecondsValid() > 0;
  }
}
