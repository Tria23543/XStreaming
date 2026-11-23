import Token from './base';

export default class UserToken extends Token {
  data;

  constructor(data) {
    super(data);
    this.data = data;
  }

  // No calculateSecondsLeft override: the base class version returns
  // -1 for a missing/unparseable expiry, while a local copy returned
  // NaN — and NaN comparisons would read a dead token as valid.

  getSecondsValid() {
    return this.calculateSecondsLeft(new Date(this.data?.expires_on));
  }

  isValid() {
    const secondsLeft = this.calculateSecondsLeft(
      new Date(this.data?.expires_on),
    );
    return secondsLeft > 0;
  }
}
