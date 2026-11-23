import Token from './base';

export default class SisuToken extends Token {
  data;

  constructor(data) {
    super(data);
    this.data = data;
  }

  getSecondsValid() {
    if (
      !this.data?.TitleToken?.NotAfter ||
      !this.data?.UserToken?.NotAfter ||
      !this.data?.AuthorizationToken?.NotAfter
    ) {
      return 0;
    }
    const secondsLeftTitle = this.calculateSecondsLeft(
      new Date(this.data.TitleToken.NotAfter),
    );
    const secondsLeftUser = this.calculateSecondsLeft(
      new Date(this.data.UserToken.NotAfter),
    );
    const secondsLeftAuthorization = this.calculateSecondsLeft(
      new Date(this.data.AuthorizationToken.NotAfter),
    );
    return Math.min(
      secondsLeftTitle,
      secondsLeftUser,
      secondsLeftAuthorization,
    );
  }

  isValid() {
    return this.getSecondsValid() > 0;
  }

  getUserHash() {
    return this.data?.UserToken?.DisplayClaims?.xui?.[0]?.uhs || false;
  }

  getGamertag() {
    return this.data?.AuthorizationToken?.DisplayClaims?.xui?.[0]?.gtg || false;
  }
}
