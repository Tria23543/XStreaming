import uuid from 'react-native-uuid';
import XstsToken from '../tokens/xststoken';
import Http from '../utils/http';
import {getSettings} from '../store/settingStore';
import {debugFactory} from '../utils/debug';

const log = debugFactory('web/index.ts');

export default class WebApi {
  webToken: XstsToken;
  settings: any;

  constructor(webToken: XstsToken) {
    this.webToken = webToken;
    this.settings = getSettings();
  }

  getClaims() {
    const xui = this.webToken?.data?.DisplayClaims?.xui;
    if (!xui || !xui[0]) {
      throw new Error('Web token is not ready, please log in again');
    }
    return xui[0];
  }

  getAuthHeader() {
    return 'XBL3.0 x=' + this.getClaims().uhs + ';' + this.webToken.data.Token;
  }

  sendCommand(
    consoleId: string,
    commandType: string,
    command: string,
    params?: any,
  ) {
    log.info('[sendCommand]:', consoleId, commandType, command);
    const http = new Http();

    if (params === undefined) {
      params = [];
    }

    const postParams = {
      destination: 'Xbox',
      type: commandType,
      command: command,
      sessionId: uuid.v4(),
      sourceId: 'com.microsoft.smartglass',
      parameters: params,
      linkedXboxId: consoleId,
    };

    return new Promise((resolve, reject) => {
      http
        .post(
          'xccs.xboxlive.com',
          '/commands',
          {
            Authorization:
              this.getAuthHeader(),
            'Accept-Language': 'en-US',
            skillplatform: 'RemoteManagement',
            'x-xbl-contract-version': '4',
            'x-xbl-client-name': 'XboxApp',
            'x-xbl-client-type': 'UWA',
            'x-xbl-client-version': '39.39.22001.0',
          },
          postParams,
        )
        .then((res: any) => {
          log.info('[sendCommand] /commands/ response:', JSON.stringify(res));
          if (res.result) {
            resolve(res.result);
          } else {
            resolve([]);
          }
        })
        .catch(e => {
          log.error('[sendCommand] error:', e?.message || e);
          reject(e);
        });
    });
  }

  powerOn(consoleId: string) {
    return this.sendCommand(consoleId, 'Power', 'WakeUp');
  }

  powerOff(consoleId: string) {
    return this.sendCommand(consoleId, 'Power', 'TurnOff');
  }

  sendText(consoleId: string, text: string) {
    return this.sendCommand(consoleId, 'Shell', 'InjectString', [
      {
        replacementString: text,
      },
    ]);
  }

  getConsoleStatus(consoleId: string) {
    const http = new Http();
    return new Promise((resolve, reject) => {
      http
        .get('xccs.xboxlive.com', '/consoles/' + consoleId, {
          Authorization:
            this.getAuthHeader(),
          'Accept-Language': 'en-US',
          skillplatform: 'RemoteManagement',
          'x-xbl-contract-version': '4',
          'x-xbl-client-name': 'XboxApp',
          'x-xbl-client-type': 'UWA',
          'x-xbl-client-version': '39.39.22001.0',
        })
        .then((res: any) => {
          log.info(
            '[getConsoleStatus] /consoles/ response:',
            JSON.stringify(res),
          );
          if (res.result) {
            resolve(res.result);
          } else {
            resolve([]);
          }
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  getConsoles() {
    const http = new Http();
    return new Promise((resolve, reject) => {
      http
        .get(
          'xccs.xboxlive.com',
          '/lists/devices?queryCurrentDevice=false&includeStorageDevices=true',
          {
            Authorization:
              this.getAuthHeader(),
            'Accept-Language': 'en-US',
            'x-xbl-contract-version': '2',
            'x-xbl-client-name': 'XboxApp',
            'x-xbl-client-type': 'UWA',
            'x-xbl-client-version': '39.39.22001.0',
          },
        )
        .then((res: any) => {
          log.info(
            '[getConsoles] /lists/devices response:',
            JSON.stringify(res),
          );
          if (res.result) {
            resolve(res.result);
          } else {
            resolve([]);
          }
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  getUserProfile() {
    const http = new Http();
    return new Promise((resolve, reject) => {
      http
        .get(
          'profile.xboxlive.com',
          '/users/me/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag',
          {
            Authorization:
              this.getAuthHeader(),
            'Accept-Language': 'en-US',
            'x-xbl-contract-version': '3',
            'x-xbl-client-name': 'XboxApp',
            'x-xbl-client-type': 'UWA',
            'x-xbl-client-version': '39.39.22001.0',
          },
        )
        .then((res: any) => {
          log.info(
            '[getUserProfile] /users/me/profile response:',
            JSON.stringify(res),
          );
          if (res.profileUsers && res.profileUsers.length > 0) {
            const infos: any = {};
            res.profileUsers[0].settings.forEach((item: any) => {
              infos[item.id] = item.value;
            });
            resolve(infos);
          } else {
            resolve({});
          }
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  getFriends() {
    const http = new Http();
    return new Promise((resolve, reject) => {
      const params = [
        'preferredcolor',
        'detail',
        'multiplayersummary',
        'presencedetail',
      ];
      http
        .get(
          'peoplehub.xboxlive.com',
          '/users/me/people/social/decoration/' + params.join(','),
          {
            Authorization:
              this.getAuthHeader(),
            'Accept-Language': this.settings.preferred_game_language
              ? this.settings.preferred_game_language
              : 'en-US',
            'x-xbl-contract-version': 3,
            'x-xbl-client-name': 'XboxApp',
            'x-xbl-client-type': 'UWA',
            'x-xbl-client-version': '39.39.22001.0',
          },
        )
        .then((res: any) => {
          // log.info('[getFriends] response:', JSON.stringify(res));
          if (res.people) {
            resolve(res.people);
          } else {
            resolve([]);
          }
        })
        .catch(e => {
          log.error('[getFriends] error:', e?.message || e);
          reject(e);
        });
    });
  }

  getHistoryAchivements() {
    const http = new Http();
    return new Promise((resolve, reject) => {
      const claims = this.getClaims();
      const uhs = claims.uhs;
      const xid = claims.xid;

      http
        .get(
          'achievements.xboxlive.com',
          `/users/xuid(${xid})/history/titles?orderBy=unlockTime`,
          {
            Authorization: 'XBL3.0 x=' + uhs + ';' + this.webToken.data.Token,
            'Accept-Language': this.settings.preferred_game_language
              ? this.settings.preferred_game_language
              : 'en-US',
            'x-xbl-contract-version': 2,
            'x-xbl-client-name': 'XboxApp',
            'x-xbl-client-type': 'UWA',
            'x-xbl-client-version': '39.39.22001.0',
          },
        )
        .then((res: any) => {
          // log.info('[getHistoryAchivements] getHistoryAchivements:', JSON.stringify(res));
          if (res.titles) {
            resolve(res.titles);
          } else {
            resolve([]);
          }
        })
        .catch(e => {
          log.error('[getHistoryAchivements] error:', e?.message || e);
          reject(e);
        });
    });
  }

  getAchivementDetail(titleId: string) {
    const http = new Http();
    return new Promise((resolve, reject) => {
      const claims = this.getClaims();
      const uhs = claims.uhs;
      const xid = claims.xid;

      http
        .get(
          'achievements.xboxlive.com',
          `/users/xuid(${xid})/achievements?titleId=${titleId}&maxItems=1000`,
          {
            Authorization: 'XBL3.0 x=' + uhs + ';' + this.webToken.data.Token,
            'Accept-Language': this.settings.preferred_game_language
              ? this.settings.preferred_game_language
              : 'en-US',
            'x-xbl-contract-version': 2,
            'x-xbl-client-name': 'XboxApp',
            'x-xbl-client-type': 'UWA',
            'x-xbl-client-version': '39.39.22001.0',
          },
        )
        .then((res: any) => {
          // log.info('[getAchivementDetail] getAchivementDetail:', JSON.stringify(res));
          if (res.achievements) {
            resolve(res.achievements);
          } else {
            resolve([]);
          }
        })
        .catch(e => {
          log.error('[getAchivementDetail] error:', e?.message || e);
          reject(e);
        });
    });
  }
}
