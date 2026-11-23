import axios from 'axios';
import {getSettings} from '../store/settingStore';
import {debugFactory} from '../utils/debug';
import {Address6} from 'ip-address';

const log = debugFactory('xCloud/index.js');

export default class XcloudApi {
  constructor(host, gsToken, type, authentication) {
    this.sessionId = '';
    this.host = host;
    this.gsToken = gsToken;
    this.type = type; // home | cloud
    this.authentication = authentication;
    this.isStoped = false;
  }

  startSession(consoleId, resolution) {
    log.info('[startSession] consoleId:', consoleId);
    this.isStoped = false;
    let osName = 'android';

    if (resolution === 1080) {
      osName = 'windows';
    } else if (resolution === 1081) {
      // 1080p-HQ
      osName = 'tizen';
    } else {
      osName = 'android';
    }
    return new Promise((resolve, reject) => {
      const _settings = getSettings();
      const deviceInfo = JSON.stringify({
        appInfo: {
          env: {
            // clientAppId: 'Microsoft.GamingApp',
            // clientAppType: 'native',
            // clientAppVersion: '2203.1001.4.0',
            // clientSdkVersion: '8.5.2',
            // httpEnvironment: 'prod',
            // sdkInstallId: '',
            clientAppId: 'www.xbox.com',
            clientAppType: 'browser',
            clientAppVersion: '26.1.97',
            clientSdkVersion: '10.3.7',
            httpEnvironment: 'prod',
            sdkInstallId: '',
          },
        },
        dev: {
          hw: {
            make: 'Microsoft',
            // 'model': 'Surface Pro',
            model: 'unknown',
            // 'sdktype': 'native',
            sdktype: 'web',
          },
          os: {
            // name: 'android', // 720P
            // name: 'windows', // 1080P
            // name: 'tizen', // 1080 hq ?
            // For console streaming
            name: osName,
            ver: '22631.2715',
            platform: 'desktop',
          },
          displayInfo: {
            dimensions: {
              widthInPixels: 1920,
              heightInPixels: 1080,
            },
            pixelDensity: {
              dpiX: 1,
              dpiY: 1,
            },
          },
          browser: {
            browserName: 'chrome',
            browserVersion: '130.0',
          },
        },
      });

      const body = JSON.stringify({
        clientSessionId: '',
        titleId: this.type === 'cloud' ? consoleId : '',
        systemUpdateGroup: '',
        settings: {
          nanoVersion: 'V3;WebrtcTransport.dll',
          enableTextToSpeech: false,
          highContrast: 0,
          locale: _settings.preferred_game_language
            ? _settings.preferred_game_language
            : 'en-US',
          useIceConnection: false,
          timezoneOffsetMinutes: 120,
          sdkType: 'web',
          // For xCloud streaming
          // osName: resolution === 720 ? 'android' : 'windows',
          osName,
        },
        serverId: this.type === 'home' ? consoleId : '',
        fallbackRegionNames: [],
      });

      axios
        .post(`${this.host}/v5/sessions/${this.type}/play`, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-MS-Device-Info': deviceInfo,
            Authorization: 'Bearer ' + this.gsToken,
          },
        })
        .then(res => {
          if (res.status === 200 || res.status === 202) {
            log.info(
              `[startSession] ${this.host}/v5/sessions/${this.type}/play res:`,
              res.data,
            );
            const sessionId = res.data.sessionPath.split('/')[3];
            this.sessionId = sessionId;

            this.waitState()
              .then(() => {
                axios
                  .get(
                    `${this.host}/v5/sessions/${this.type}/${this.sessionId}/configuration`,
                    {
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + this.gsToken,
                      },
                    },
                  )
                  .then(result => {
                    log.info(
                      '[startSession] /configuration res:',
                      JSON.stringify(result.data),
                    );
                    resolve(result.data);
                  })
                  .catch(error => {
                    // Without this the outer promise never settles when
                    // the configuration request fails.
                    reject(error);
                  });
              })
              .catch(error => {
                reject(error);
              });
          } else {
            // Axios resolves any 2xx; a status other than 200/202 must
            // not leave the outer promise unsettled forever.
            reject(
              new Error(
                'Streaming failed: unexpected session status ' + res.status,
              ),
            );
          }
        })
        .catch(e => {
          log.info('[startSession] error:', e);
          reject(e);
        });
    });
  }

  // Check host streaming status is ready or not
  waitState(attempts = 0) {
    return new Promise((resolve, reject) => {
      axios
        .get(`${this.host}/v5/sessions/${this.type}/${this.sessionId}/state`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.gsToken,
          },
        })
        .then(res => {
          log.info('[waitState] res:', res.data);
          const _state = res.data;
          switch (_state.state) {
            // Streaming ready
            case 'Provisioned':
              resolve(_state);
              break;
            // Connecting
            case 'WaitingForResources':
            case 'Provisioning':
              if (this.isStoped) {
                // Canceled
                // reject('Streaming canceled');
                reject('');
              } else if (attempts >= 180) {
                // ~3 minutes of 1s polls: give up instead of looping
                // forever on a session that will never become ready.
                reject(
                  'Streaming failed: timed out waiting for the session to become ready',
                );
              } else {
                setTimeout(() => {
                  // Continue
                  this.waitState(attempts + 1)
                    .then(state => {
                      resolve(state);
                    })
                    .catch(error => {
                      reject(error);
                    });
                }, 1000);
              }
              break;
            case 'ReadyToConnect':
              if (this.isStoped) {
                reject('');
                break;
              }
              if (attempts >= 180) {
                // Same cap as the provisioning branch: a session parked
                // in ReadyToConnect must not loop forever, repeatedly
                // exchanging the account's refresh token.
                reject(
                  'Streaming failed: timed out waiting for the session to become ready',
                );
                break;
              }
              // Do MSAL Auth
              this.authentication._xal
                .getMsalToken(this.authentication._tokenStore)
                .then(msalToken => {
                  this.sendMSALAuth(msalToken.data.lpt)
                    .then(() => {
                      this.waitState(attempts + 1)
                        .then(state => {
                          resolve(state);
                        })
                        .catch(error => {
                          reject(error);
                        });
                    })
                    .catch(error => {
                      reject(error);
                    });
                })
                .catch(error => {
                  reject(error);
                });
              break;
            case 'Failed':
              reject(
                'Streaming failed: ' +
                  ((_state.errorDetails && _state.errorDetails.message) ||
                    'unknown error'),
              );
              break;
            default:
              log.info('unknown state:', _state);
              reject('Streaming failed');
              break;
          }
        })
        .catch(e => {
          log.info('[waitState] error:', e);
          reject(e);
        });
    });
  }

  // sendSDPOffer
  sendSDPOffer(sdpOffer) {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        messageType: 'offer',
        sdp: sdpOffer.sdp,
        configuration: {
          chatConfiguration: {
            bytesPerSample: 2,
            expectedClipDurationMs: 20,
            format: {
              codec: 'opus',
              container: 'webm',
            },
            numChannels: 1,
            sampleFrequencyHz: 24000,
          },
          chat: {
            minVersion: 1,
            maxVersion: 1,
          },
          control: {
            minVersion: 1,
            maxVersion: 3,
          },
          input: {
            minVersion: 1,
            maxVersion: 8,
          },
          message: {
            minVersion: 1,
            maxVersion: 1,
          },
        },
      });
      axios
        .post(
          `${this.host}/v5/sessions/${this.type}/${this.sessionId}/sdp`,
          body,
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + this.gsToken,
            },
          },
        )
        .then(() => {
          // The first post for SDP did not return, so a GET request for SDP response needs to be initiated.
          axios
            .get(
              `${this.host}/v5/sessions/${this.type}/${this.sessionId}/sdp`,
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: 'Bearer ' + this.gsToken,
                },
              },
            )
            .then(res => {
              log.info('[sendSDPOffer] res.data:', res.data);
              if (res.data.exchangeResponse) {
                resolve(res.data);
              } else {
                let sdpPolls = 0;
                const checkInterval = setInterval(() => {
                  if (this.isStoped) {
                    clearInterval(checkInterval);
                    return;
                  }
                  sdpPolls += 1;
                  if (sdpPolls > 120) {
                    // Mirror checkIceResponse's cap: a session that keeps
                    // answering without an exchangeResponse must surface
                    // an error instead of polling forever. (The isStoped
                    // branch above still leaves the promise unsettled on
                    // purpose after teardown.)
                    clearInterval(checkInterval);
                    reject(
                      new Error(
                        '[sendSDPOffer] timed out waiting for the SDP answer',
                      ),
                    );
                    return;
                  }
                  axios
                    .get(
                      `${this.host}/v5/sessions/${this.type}/${this.sessionId}/sdp`,
                      {
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: 'Bearer ' + this.gsToken,
                        },
                      },
                    )
                    .then(res2 => {
                      if (res2.data.exchangeResponse) {
                        resolve(res2.data);
                        clearInterval(checkInterval);
                      }
                    })
                    .catch(e => {
                      reject(e);
                      clearInterval(checkInterval);
                    });
                }, 1000);
              }
              // resolve(sdpResponse.exchangeResponse);
            })
            .catch(e => {
              reject(e);
            });
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  checkIceResponse(attempts = 0) {
    return new Promise((resolve, reject) => {
      axios
        .get(`${this.host}/v5/sessions/${this.type}/${this.sessionId}/ice`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.gsToken,
          },
        })
        .then(iceResponse => {
          const iceResult = iceResponse.data;
          log.info('[checkIceResponse] res:', iceResult);

          if (iceResult === '') {
            if (this.isStoped) {
              // The stream was stopped: end the polling here. The promise
              // is deliberately left unsettled — the caller has already
              // torn the stream down, and settling either way would
              // surface as a spurious result/error after exit.
              return;
            }
            if (attempts >= 120) {
              reject(
                new Error(
                  '[checkIceResponse] timed out waiting for ICE candidates',
                ),
              );
              return;
            }
            setTimeout(() => {
              // Continue check
              this.checkIceResponse(attempts + 1)
                .then(state => {
                  resolve(state);
                })
                .catch(error => {
                  reject(error);
                });
            }, 1000);
          } else {
            const exchangeIce = JSON.parse(iceResult.exchangeResponse);
            const computedCandidates = [];

            // Find Teredo Address and extract remote ip
            for (const candidate in exchangeIce) {
              const rawCandidate = exchangeIce[candidate]
                ? exchangeIce[candidate].candidate
                : null;
              if (typeof rawCandidate !== 'string') {
                // Entries without a candidate string can't be parsed;
                // they are still passed through below.
                computedCandidates.push(exchangeIce[candidate]);
                continue;
              }
              const candidateAddress = rawCandidate.split(' ');
              if (
                candidateAddress.length > 4 &&
                candidateAddress[4].substr(0, 4) === '2001'
              ) {
                const address = new Address6(candidateAddress[4]);
                const teredo = address.inspectTeredo();

                computedCandidates.push({
                  candidate:
                    'a=candidate:10 1 UDP 1 ' +
                    teredo.client4 +
                    ' 9002 typ host ',
                  messageType: 'iceCandidate',
                  sdpMLineIndex: '0',
                  sdpMid: '0',
                });
                computedCandidates.push({
                  candidate:
                    'a=candidate:11 1 UDP 1 ' +
                    teredo.client4 +
                    ' ' +
                    teredo.udpPort +
                    ' typ host ',
                  messageType: 'iceCandidate',
                  sdpMLineIndex: '0',
                  sdpMid: '0',
                });
              }

              computedCandidates.push(exchangeIce[candidate]);
            }

            const pattern = new RegExp(
              /^(?:a=)?candidate:(?<foundation>\d+) (?<component>\d+) (?<protocol>\w+) (?<priority>\d+) (?<ip>[^\s]+) (?<port>\d+) (?<the_rest>.*)/,
            );

            const lst = [];
            for (let item of computedCandidates) {
              if (!item || typeof item.candidate !== 'string') {
                continue;
              }
              if (item.candidate === 'a=end-of-candidates') {
                continue;
              }

              const match = pattern.exec(item.candidate);
              if (!match) {
                // One malformed candidate must not reject the whole
                // exchange; skip it and keep the usable candidates.
                continue;
              }
              lst.push(match.groups);
            }

            // PerferIPV6
            const _settings = getSettings();
            if (_settings.ipv6) {
              lst.sort((a, b) => {
                const firstIp = a.ip;
                const secondIp = b.ip;

                return !firstIp.includes(':') && secondIp.includes(':')
                  ? 1
                  : -1;
              });
            }

            const newCandidates = [];
            let foundation = 1;

            const newCandidate = candidate => {
              return {
                candidate: candidate,
                messageType: 'iceCandidate',
                sdpMLineIndex: '0',
                sdpMid: '0',
              };
            };

            lst.forEach(item => {
              item.foundation = foundation;
              item.priority = foundation === 1 ? 2130706431 : 1;

              newCandidates.push(
                newCandidate(
                  `a=candidate:${item.foundation} 1 UDP ${item.priority} ${item.ip} ${item.port} ${item.the_rest}`,
                ),
              );
              ++foundation;
            });

            newCandidates.push(newCandidate('a=end-of-candidates'));

            resolve(newCandidates);
          }
        })
        .catch(e => {
          log.info('[checkIceResponse] error:', e);
          reject(e);
        });
    });
  }

  sendICECandidates(iceCandidates) {
    log.info(
      '[sendICECandidates] iceCandidates:',
      JSON.stringify(iceCandidates),
    );
    return new Promise((resolve, reject) => {
      const postData = {
        messageType: 'iceCandidate',
        candidate: iceCandidates,
      };
      axios
        .post(
          `${this.host}/v5/sessions/${this.type}/${this.sessionId}/ice`,
          JSON.stringify(postData),
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + this.gsToken,
            },
          },
        )
        .then(() => {
          // Check ICE result
          this.checkIceResponse()
            .then(candidates => {
              resolve(candidates);
            })
            .catch(error => {
              reject(error);
            });
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  sendMSALAuth(userToken) {
    return new Promise((resolve, reject) => {
      axios
        .post(
          `${this.host}/v5/sessions/${this.type}/${this.sessionId}/connect`,
          {
            userToken,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + this.gsToken,
            },
          },
        )
        .then(res => {
          resolve();
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  sendKeepalive() {
    return new Promise((resolve, reject) => {
      axios
        .post(
          `${this.host}/v5/sessions/${this.type}/${this.sessionId}/keepalive`,
          {},
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + this.gsToken,
            },
          },
        )
        .then(res => {
          resolve(res.data);
        })
        .catch(e => {
          // reject() takes a single argument; embed the cause in an Error
          // instead of dropping it.
          reject(
            new Error(
              '[sendKeepalive] error: ' + ((e && e.message) || String(e)),
            ),
          );
        });
    });
  }

  stopStream() {
    return new Promise((resolve, reject) => {
      this.isStoped = true;
      if (!this.sessionId) {
        resolve();
        return;
      }
      axios
        .delete(`${this.host}/v5/sessions/${this.type}/${this.sessionId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.gsToken,
          },
        })
        .then(res => {
          log.info('Stream stop:', res);
          resolve(res.data);
        })
        .catch(e => {
          reject(e);
        });
    });
  }

  getActiveSessions() {
    return new Promise((resolve, reject) => {
      axios
        .get(`${this.host}/v5/sessions/${this.type}/active`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.gsToken,
          },
        })
        .then(res => {
          resolve(res.data);
        })
        .catch(e => {
          log.info('getActiveSessions error: ', e);
          resolve([]);
        });
    });
  }

  getOfficialTitles() {
    return new Promise(resolve => {
      let officialTitles = [];
      axios
        .get('https://cdn.jsdelivr.net/gh/Geocld/XStreaming@main/titles.json', {
          // Axios timeouts are milliseconds: 30ms made this fetch fail
          // every time, silently disabling the official-titles merge.
          timeout: 30000,
        })
        .then(res => {
          if (res.status === 200) {
            officialTitles = res.data.Products;
          }
          resolve(officialTitles);
        })
        .catch(e => {
          resolve([]);
        });
    });
  }

  getGamePassProducts(titles, onProgress) {
    return new Promise((resolve, reject) => {
      const productIdQueue = [];
      const v2TitleMap = {};
      if (!Array.isArray(titles)) {
        log.info('[getGamePassProducts] error titles is not a array:', titles);
        resolve([]);
        return;
      }
      titles.forEach(title => {
        if (title.details && title.details.productId) {
          productIdQueue.push(title.details.productId);
          v2TitleMap[title.details.productId] = title;
        }
      });

      // Get officialTitles
      this.getOfficialTitles().then(async officialTitles => {
        // Fix: v2/titles API can not get full games
        const mergeProductIds = [
          ...new Set([...productIdQueue, ...officialTitles]),
        ];
        // Hydrate in chunks of 200, fetched in parallel batches of 4,
        // reporting progress after each batch so the library screen can
        // fill in progressively. A chunk that fails is retried once; a
        // chunk that fails twice is skipped and hydration continues with
        // the rest instead of failing the whole library.
        const mergedById = {};
        const CHUNK_SIZE = 200;
        const BATCH_SIZE = 4;
        const chunks = [];
        for (let i = 0; i < mergeProductIds.length; i += CHUNK_SIZE) {
          chunks.push(mergeProductIds.slice(i, i + CHUNK_SIZE));
        }
        const fetchChunk = async chunk => {
          let lastError = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const res = await axios.post(
                'https://catalog.gamepass.com/v3/products?market=US&language=en-US&hydration=RemoteLowJade0',
                {
                  Products: chunk,
                },
                {
                  headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'ms-cv': 0,
                    'calling-app-name': 'Xbox Cloud Gaming Web',
                    'calling-app-version': '24.17.63',
                  },
                },
              );
              return res;
            } catch (e) {
              lastError = e;
            }
          }
          throw lastError;
        };
        try {
          for (let b = 0; b < chunks.length; b += BATCH_SIZE) {
            const batch = chunks.slice(b, b + BATCH_SIZE);
            const results = await Promise.all(
              batch.map(chunk =>
                fetchChunk(chunk).catch(e => {
                  log.info(
                    'getGamePassProducts chunk failed twice, skipping:',
                    (e && e.message) || e,
                  );
                  return null;
                }),
              ),
            );
            for (const res of results) {
              if (res && res.data && res.data.Products) {
                const products = res.data.Products;
                for (const key in products) {
                  if (v2TitleMap[key]) {
                    mergedById[key] = {
                      productId: key,
                      ...products[key],
                      ...v2TitleMap[key],
                    };
                  } else {
                    mergedById[key] = {
                      productId: key,
                      ...products[key],
                    };
                  }
                }
              }
            }
            if (onProgress) {
              const partial = Object.values(mergedById);
              partial.sort((a, b) =>
                (a.ProductTitle || '').localeCompare(b.ProductTitle || ''),
              );
              onProgress(partial);
            }
          }
        } catch (e) {
          log.info('getGamePassProducts error:', e);
          reject(e);
          return;
        }
        const mergedTitles = Object.values(mergedById);
        mergedTitles.sort((a, b) =>
          (a.ProductTitle || '').localeCompare(b.ProductTitle || ''),
        );
        resolve(mergedTitles);
      });
    });
  }

  // Get all games of XGPU
  getTitles() {
    return new Promise((resolve, reject) => {
      axios
        .get(`${this.host}/v2/titles`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.gsToken,
          },
        })
        .then(res => {
          resolve(res.data);
        })
        .catch(e => {
          log.info('getTitles error: ', e);
          resolve([]);
        });
    });
  }

  // Get recently add games of XGPU
  getNewTitles() {
    return new Promise((resolve, reject) => {
      axios
        .get(
          'https://catalog.gamepass.com/sigls/v2?id=f13cf6b4-57e6-4459-89df-6aec18cf0538&market=US&language=en-US',
        )
        .then(res => {
          resolve(res.data);
        })
        .catch(e => {
          resolve([]);
        });
    });
  }

  // Get a curated catalog gallery list (same gallery system xbox.com/play
  // uses for Popular, Leaving soon, Mouse and keyboard, ...)
  getSiglTitles(siglId) {
    return new Promise((resolve, reject) => {
      axios
        .get(
          'https://catalog.gamepass.com/sigls/v2?id=' +
            siglId +
            '&market=US&language=en-US',
        )
        .then(res => {
          resolve(res.data);
        })
        .catch(e => {
          resolve([]);
        });
    });
  }

  // Get recently play games of user
  getRecentTitles() {
    return new Promise((resolve, reject) => {
      axios
        .get(`${this.host}/v2/titles/mru?mr=25`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + this.gsToken,
          },
        })
        .then(res => {
          // log.info('getRecentTitles res:', res.data);
          resolve(res.data);
        })
        .catch(e => {
          resolve([]);
        });
    });
  }
}
