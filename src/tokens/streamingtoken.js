import Token from './base';

export default class StreamingToken extends Token {
  constructor(tokenData) {
    super(tokenData);
    this.data = tokenData;
    this._objectCreateTime = Date.now();
  }

  calculateSecondsLeft(date) {
    const expiresOn = date;
    const currentDate = new Date();
    return Math.floor((expiresOn.getTime() - currentDate.getTime()) / 1000);
  }

  getSecondsValid() {
    if (this.data?.durationInSeconds) {
      return this.calculateSecondsLeft(
        new Date(this._objectCreateTime + this.data.durationInSeconds * 1000),
      );
    }

    return 0;
  }

  isValid() {
    return this.getSecondsValid() > 0;
  }

  getMarket() {
    return this.data?.market;
  }

  getRegions() {
    return this.data?.offeringSettings?.regions || [];
  }

  getDefaultRegion() {
    const regions = this.getRegions();
    return regions.filter(region => region.isDefault)[0] || regions[0];
  }

  setDefaultRegion(name) {
    const regions = this.getRegions();
    if (!regions.some(region => region.name === name)) {
      return false;
    }
    regions.forEach(region => {
      region.isDefault = region.name === name;
    });
    return true;
  }

  getEnvironments() {
    return this.data?.offeringSettings?.clientCloudSettings?.Environments || [];
  }
}
