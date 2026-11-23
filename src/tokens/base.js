export default class Token {
  data;

  constructor(data) {
    this.data = data;
  }

  calculateSecondsLeft(date) {
    const time = date && date.getTime ? date.getTime() : NaN;
    if (isNaN(time)) {
      // Missing/unparseable expiry (e.g. no NotAfter): treat the token as
      // already expired instead of comparing against NaN, which would
      // make isValid() report a dead token as valid forever.
      return -1;
    }
    const currentDate = new Date();
    return Math.floor((time - currentDate.getTime()) / 1000);
  }

  getSecondsValid() {
    console.log('Warning: getSecondsValid not implemented');

    return 0;
  }

  isValid() {
    console.log('Warning: isValid not implemented');

    return false;
  }

  getUserHash() {
    if (this.data && 'UserToken' in this.data) {
      return this.data.UserToken?.DisplayClaims?.xui?.[0]?.uhs || false;
    }

    return false;
  }

  getGamertag() {
    if (this.data && 'AuthorizationToken' in this.data) {
      return this.data.AuthorizationToken?.DisplayClaims?.xui?.[0]?.gtg || false;
    }

    return false;
  }
}
