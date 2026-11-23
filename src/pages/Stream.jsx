import React from 'react';
import {
  View,
  Alert,
  NativeModules,
  Vibration,
  NativeEventEmitter,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import {
  Portal,
  Modal,
  Card,
  List,
  Button,
  IconButton,
  TextInput,
  Text,
  Snackbar,
} from 'react-native-paper';
import {WebView} from 'react-native-webview';
import Orientation from 'react-native-orientation-locker';
import RNRestart from 'react-native-restart';
import XcloudApi from '../xCloud';
import {useSelector} from 'react-redux';
import {getSettings, saveSettings} from '../store/settingStore';
import {useTranslation} from 'react-i18next';
import {debugFactory} from '../utils/debug';
import WebApi from '../web';
import VirtualGamepad from '../components/VirtualGamepad';
import CustomVirtualGamepad from '../components/CustomVirtualGamepad';
import PerfPanel from '../components/PerfPanel';
import Display from '../components/Display';
import {GAMEPAD_MAPING} from '../common';

const log = debugFactory('StreamScreen');

const CONNECTED = 'connected';

const gpState = {
  A: 0,
  B: 0,
  X: 0,
  Y: 0,
  LeftShoulder: 0,
  RightShoulder: 0,
  LeftTrigger: 0,
  RightTrigger: 0,
  View: 0,
  Menu: 0,
  LeftThumb: 0,
  RightThumb: 0,
  DPadUp: 0,
  DPadDown: 0,
  DPadLeft: 0,
  DPadRight: 0,
  Nexus: 0,

  LeftThumbXAxis: 0.0,
  LeftThumbYAxis: 0.0,
  RightThumbXAxis: 0.0,
  RightThumbYAxis: 0.0,
};

const {GamepadManager} = NativeModules;

const eventEmitter = new NativeEventEmitter(GamepadManager);

const getPressedButtons = combinedValue => {
  const pressedButtons = [];
  for (const [button, value] of Object.entries(GAMEPAD_MAPING)) {
    // eslint-disable-next-line no-bitwise
    if ((combinedValue & value) === value) {
      pressedButtons.push(button);
    }
  }
  return pressedButtons;
};

const setGpState = combinedKeys => {
  const keys = [
    'A',
    'B',
    'X',
    'Y',
    'LeftShoulder',
    'RightShoulder',
    'View',
    'Menu',
    'LeftThumb',
    'RightThumb',
    'DPadUp',
    'DPadDown',
    'DPadLeft',
    'DPadRight',
    'Nexus',
  ];
  keys.forEach(k => {
    if (combinedKeys.includes(k)) {
      gpState[k] = 1;
    } else {
      gpState[k] = 0;
    }
  });
};

const resetButtonState = () => {
  const keys = [
    'A',
    'B',
    'X',
    'Y',
    'LeftShoulder',
    'RightShoulder',
    'View',
    'Menu',
    'LeftThumb',
    'RightThumb',
    'DPadUp',
    'DPadDown',
    'DPadLeft',
    'DPadRight',
    'Nexus',
  ];
  keys.forEach(k => {
    gpState[k] = 0;
  });
};

function StreamScreen({navigation, route}) {
  const {t} = useTranslation();
  const authentication = useSelector(state => state.authentication);
  const streamingTokens = useSelector(state => state.streamingTokens);
  const webToken = useSelector(state => state.webToken);

  // The tokens this stream is started with, captured once. Home stays
  // mounted under this screen and dispatches FRESH token objects on
  // every successful re-check (any connectivity flap triggers one);
  // the session objects below must be built from the tokens the
  // session was created with, never swapped mid-stream.
  const streamTokensRef = React.useRef(null);
  if (
    !streamTokensRef.current &&
    (streamingTokens.xCloudToken || streamingTokens.xHomeToken)
  ) {
    streamTokensRef.current = streamingTokens;
  } else if (streamTokensRef.current) {
    // The snapshot can be captured half-empty (only one token kind
    // had arrived) and the session effect reads it as-is, so the
    // missing kind's games could never start. Fill in a kind that
    // was missing then — never replace a captured kind: a token of
    // the missing kind belongs to no live session yet, so adopting
    // it cannot swap anything mid-stream.
    const snap = streamTokensRef.current;
    if (
      (!snap.xCloudToken && streamingTokens.xCloudToken) ||
      (!snap.xHomeToken && streamingTokens.xHomeToken)
    ) {
      streamTokensRef.current = {
        xCloudToken: snap.xCloudToken || streamingTokens.xCloudToken,
        xHomeToken: snap.xHomeToken || streamingTokens.xHomeToken,
      };
    }
  }
  const hasStreamingTokens = !!(
    streamingTokens.xCloudToken || streamingTokens.xHomeToken
  );

  const [xHomeApi, setXHomeApi] = React.useState(null);
  const [xCloudApi, setXCloudApi] = React.useState(null);
  const [settings, setSettings] = React.useState({});
  const [isExiting, setIsExiting] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [showTipsModal, setShowTipsModal] = React.useState(false);
  const [showWebview, setShowWebview] = React.useState(false);
  const [showDisplayModal, setShowDisplayModal] = React.useState(false);
  const [showMessageModal, setShowMessageModal] = React.useState(false);
  const [showVirtualGamepad, setShowVirtualGamepad] = React.useState(false);
  const [connectState, setConnectState] = React.useState('');
  const [performance, setPerformance] = React.useState({});
  const [showPerformance, setShowPerformance] = React.useState(false);
  // A ref, not state: the menu handler sets this and calls
  // requestExit() in the same press, and the exit fallback timer can
  // fire the handleExit closure captured from THAT render — with
  // state, that closure still saw false and the power-off was
  // silently skipped when the WebView never answered. A ref reads
  // the current value in every closure.
  const needPoweroffRef = React.useRef(false);
  // Armed when the streamingClosed alert is PRESENTED (not when the
  // exit begins): a second streamingClosed message arriving while
  // the alert is up must not stack a duplicate alert.
  const closedAlertShownRef = React.useRef(false);
  // Shared across handleTimeoutExit invocations: a second
  // timeoutExit message must not run a second finish (duplicate
  // stop/restart side effects).
  const timeoutExitFinishedRef = React.useRef(false);
  const timeoutExitInFlightRef = React.useRef(false);
  // True while the session effect is live; its cleanup clears it.
  // Async completions that outlive the screen (a stopStream promise
  // settling after unmount) check it before causing effects.
  const streamAliveRef = React.useRef(false);
  const [modalMaxHeight, setModalMaxHeight] = React.useState(250);
  const [message, setMessage] = React.useState('');
  const [messageSending, setMessageSending] = React.useState(false);
  const [toastText, setToastText] = React.useState('');

  const controllerEventListener = React.useRef(undefined);
  const timer = React.useRef(undefined);

  React.useEffect(() => {
    const _settings = getSettings();
    setSettings(_settings);

    const normaliseAxis = value => {
      if (_settings.dead_zone) {
        if (Math.abs(value) < _settings.dead_zone) {
          return 0;
        }

        value = value - Math.sign(value) * _settings.dead_zone;
        value /= 1.0 - _settings.dead_zone;

        // Joystick edge compensation
        const THRESHOLD = 0.8;
        const MAX_VALUE = 1;
        const compensation = _settings.edge_compensation / 100 || 0;
        if (Math.abs(value) > THRESHOLD) {
          if (value > 0) {
            value = Math.min(value + compensation, MAX_VALUE);
          } else {
            value = Math.max(value - compensation, -MAX_VALUE);
          }
        }
        return value;
      } else {
        return value;
      }
    };

    // Controller
    if (_settings.gamepad_kernal === 'Native') {
      log.info('Entry native mode');
      controllerEventListener.current = eventEmitter.addListener(
        'onController',
        params => {
          const {
            buttonFlags,
            leftTrigger,
            rightTrigger,
            leftStickX,
            leftStickY,
            rightStickX,
            rightStickY,
          } = params;

          if (buttonFlags !== 0) {
            const keys = getPressedButtons(buttonFlags);
            setGpState(keys);
          } else {
            resetButtonState();
          }

          // Trigger
          gpState.LeftTrigger = leftTrigger;
          gpState.RightTrigger = rightTrigger;

          // Joystick
          gpState.LeftThumbXAxis = normaliseAxis(leftStickX);
          gpState.LeftThumbYAxis = normaliseAxis(-leftStickY);
          gpState.RightThumbXAxis = normaliseAxis(rightStickX);
          gpState.RightThumbYAxis = normaliseAxis(-rightStickY);
        },
      );

      timer.current = setInterval(() => {
        postData2Webview('gamepad', gpState);
      }, 4);
    }

    if (route.params?.sessionId) {
      log.info('Stream screen receive sessionId:', route.params?.sessionId);
    }
    if (route.params?.streamType) {
      log.info('Stream screen receive streamType:', route.params?.streamType);
    }
    exitedRef.current = false;
    closedAlertShownRef.current = false;
    timeoutExitFinishedRef.current = false;
    timeoutExitInFlightRef.current = false;
    streamAliveRef.current = true;
    const tokens = streamTokensRef.current || {};
    let builtHomeApi = null;
    let builtCloudApi = null;
    if (tokens.xHomeToken) {
      const region = tokens.xHomeToken.getDefaultRegion();
      if (region) {
        const _xHomeApi = new XcloudApi(
          region.baseUri,
          tokens.xHomeToken.data.gsToken,
          'home',
          authentication,
        );
        builtHomeApi = _xHomeApi;
        setXHomeApi(_xHomeApi);
      }
    }
    if (tokens.xCloudToken) {
      const region = tokens.xCloudToken.getDefaultRegion();
      if (region) {
        const _xCloudApi = new XcloudApi(
          region.baseUri,
          tokens.xCloudToken.data.gsToken,
          'cloud',
          authentication,
        );
        builtCloudApi = _xCloudApi;
        setXCloudApi(_xCloudApi);
      }
    }

    // Keep every timer id so the cleanup can cancel the whole chain:
    // otherwise the timers fire after unmount and can re-lock the phone
    // to landscape after the user has already exited.
    const timeoutIds = [];
    timeoutIds.push(
      setTimeout(() => {
        Orientation.lockToLandscape();

        timeoutIds.push(
          setTimeout(() => {
            const {height: dHeight} = Dimensions.get('window');
            setModalMaxHeight(dHeight - 50);
            setShowWebview(true);
            timeoutIds.push(
              setTimeout(() => {
                webviewRef.current && webviewRef.current.requestFocus();
              }, 100),
            );
          }, 800),
        );
      }, 500),
    );

    return () => {
      streamAliveRef.current = false;
      timeoutIds.forEach(id => clearTimeout(id));
      Orientation.unlockAllOrientations();
      timer.current && clearInterval(timer.current);
      controllerEventListener.current &&
        controllerEventListener.current.remove();
      if (finishExitTimer.current) {
        clearTimeout(finishExitTimer.current);
        finishExitTimer.current = null;
      }
      if (timeoutExitFallbackTimer.current) {
        clearTimeout(timeoutExitFallbackTimer.current);
        timeoutExitFallbackTimer.current = null;
      }
      if (restartTimer.current) {
        clearTimeout(restartTimer.current);
        restartTimer.current = null;
      }
      // Leaving without Disconnect must not orphan the session
      // server-side (the console slot stays busy until Microsoft's
      // timeout reaps it): stop the stream on the APIs this effect
      // built. handleExit stops it too — a second stop on a closed
      // session just errors and is swallowed here.
      [builtCloudApi, builtHomeApi].forEach(api => {
        if (api && api.stopStream) {
          try {
            const stopResult = api.stopStream();
            if (stopResult && stopResult.catch) {
              stopResult.catch(() => {});
            }
          } catch (e) {}
        }
      });
      // The Disconnect fallback timer must not fire after unmount: it
      // would run handleExit() and navigate Home with needRefresh even
      // though the user already left by another route.
      if (exitFallbackTimer.current) {
        clearTimeout(exitFallbackTimer.current);
        exitFallbackTimer.current = null;
      }
    };
  }, [
    route.params?.sessionId,
    route.params?.streamType,
    // A boolean, not the token object: it flips once when the first
    // tokens arrive and never again on refresh, so a mid-stream token
    // refresh cannot re-run this effect and rebuild the session.
    hasStreamingTokens,
    navigation,
    authentication,
  ]);

  const streamApi = route.params?.streamType === 'cloud' ? xCloudApi : xHomeApi;

  // const uri = 'file:///android_asset/stream/index.html';
  const uri = Platform.select({
    android: 'file:///android_asset/stream/index.html',
    ios: 'index.html', // iOS 会自动从 bundle 中查找
    // ios: 'http://172.25.176.27:5173/',
  });

  const webviewRef = React.useRef(null);
  const exitFallbackTimer = React.useRef(null);
  const finishExitTimer = React.useRef(null);
  const timeoutExitFallbackTimer = React.useRef(null);
  const restartTimer = React.useRef(null);
  // True once an exit has begun (set at handleExit entry, not when
  // the navigation timer fires): a streamingClosed message arriving
  // after that belongs to the finished session and must not pop its
  // alert over the Home screen or run a second exit.
  const exitedRef = React.useRef(false);
  const tipsShownRef = React.useRef(false);
  const connectedToastRef = React.useRef(false);
  const [webviewError, setWebviewError] = React.useState(false);

  const handlePowerOff = async () => {
    try {
      const webApi = new WebApi(webToken);
      await webApi.powerOff(route.params?.sessionId);
      log.info('powerOff done');
    } catch (e) {
      // Called fire-and-forget during exit: a failed power-off must not
      // surface as an unhandled rejection (the exit proceeds regardless).
      log.error('Power off error:', (e && e.message) || e);
    }
  };

  const handleSendMessage = async () => {
    setMessageSending(true);
    let text = message.trim();
    if (text.length > 100) {
      text = text.substring(0, 100);
    }
    try {
      // Constructed inside the try (like handlePowerOff): if the
      // constructor throws, the catch below reports it instead of
      // the press handler rejecting unhandled and doing nothing.
      const webApi = new WebApi(webToken);
      await webApi.sendText(route.params?.sessionId, text);
      setMessage('');
      setToastText(t('Sent'));
    } catch (e) {
      setToastText(t('Failed to send'));
    }
    setMessageSending(false);
  };

  const handleExit = () => {
    // exitedRef as well as the state: finishExit resets isExiting
    // when the first exit completes, and a late trigger (the
    // streamingClosed alert's Confirm or dismiss timer, firing after
    // the user was already taken Home) must not run a second exit.
    if (isExiting || exitedRef.current) {
      return;
    }
    // Mark the exit as begun NOW, not when finishExit's navigation
    // timer fires after stopStream() settles: a streamingClosed
    // arriving in that window must already see the flag, or its
    // alert pops over Home and its Confirm runs a second exit.
    exitedRef.current = true;
    if (exitFallbackTimer.current) {
      clearTimeout(exitFallbackTimer.current);
      exitFallbackTimer.current = null;
    }
    setIsExiting(true);
    const finishExit = () => {
      if (needPoweroffRef.current) {
        handlePowerOff();
      }
      // Tracked so the unmount cleanup can cancel it: untracked, it
      // would navigate Home even if the user already left by another
      // route inside this half second.
      finishExitTimer.current = setTimeout(() => {
        finishExitTimer.current = null;
        exitedRef.current = true;
        setIsExiting(false);
        Orientation.unlockAllOrientations();
        navigation.navigate({
          name: 'Home',
          params: {needRefresh: true},
        });
      }, 500);
    };
    if (!streamApi) {
      finishExit();
      return;
    }
    streamApi
      .stopStream()
      .then(finishExit)
      .catch(() => finishExit());
  };

  const handleTimeoutExit = () => {
    // A previous invocation finished the exit, or one is already in
    // flight: a duplicate timeoutExit message must not repeat its
    // side effects. Guarding only the finish let a second in-flight
    // invocation call stopStream again and overwrite the fallback
    // timer ref, orphaning the first timer past the unmount cleanup.
    if (timeoutExitFinishedRef.current || timeoutExitInFlightRef.current) {
      return;
    }
    timeoutExitInFlightRef.current = true;
    const finishTimeoutExit = () => {
      // The user already left: a stopStream promise settling late
      // must not arm the restart timer now — nothing would clear it,
      // and the app would restart over whatever the user moved on to.
      if (!streamAliveRef.current) {
        return;
      }
      if (timeoutExitFinishedRef.current) {
        return;
      }
      timeoutExitFinishedRef.current = true;
      timeoutExitInFlightRef.current = false;
      if (timeoutExitFallbackTimer.current) {
        clearTimeout(timeoutExitFallbackTimer.current);
        timeoutExitFallbackTimer.current = null;
      }
      authentication &&
        authentication._tokenStore &&
        authentication._tokenStore.clearTokenUpdateTime();
      restartTimer.current = setTimeout(() => {
        restartTimer.current = null;
        RNRestart.restart();
      }, 100);
    };
    if (!streamApi) {
      finishTimeoutExit();
      return;
    }
    // The restart must not depend on stopStream settling: a hung
    // session request would otherwise strand the user on this screen
    // forever, with the token-refresh restart never happening.
    timeoutExitFallbackTimer.current = setTimeout(finishTimeoutExit, 3000);
    streamApi
      .stopStream()
      .then(finishTimeoutExit)
      .catch(() => finishTimeoutExit());
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (settings.gamepad_kernal === 'Web') {
      webviewRef.current && webviewRef.current.requestFocus();
    }
  };

  const postData2Webview = (type, value) => {
    webviewRef.current &&
      webviewRef.current.postMessage(JSON.stringify({type, value}));
  };

  const handleWebviewMessage = event => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch (e) {
      // A malformed WebView message must not throw inside onMessage.
      return;
    }
    const {type, message} = data || {};
    if (type === 'other') {
      // Two-argument form: a lone string becomes the alert TITLE
      // with an empty body, and a non-string message would render
      // as "[object Object]".
      const otherText =
        typeof message === 'string'
          ? message
          : JSON.stringify(message ?? '') || '';
      // Emptiness is judged on the message itself, not on the
      // stringified text: an absent message stringifies to the two
      // characters `""`, but so does a genuine message consisting of
      // exactly two quote characters — comparing the stringified
      // text swallowed that real message as if it were absent.
      const hasContent =
        message !== undefined &&
        message !== null &&
        !(typeof message === 'string' && message.trim() === '');
      if (hasContent) {
        Alert.alert(t('Warning'), otherText);
      } else {
        log.info('WebView other message with no content');
      }
    }
    // The session-flow messages dereference streamApi; if it was never
    // created (missing token/region), fail visibly instead of throwing.
    if (
      (type === 'xcloudReady' ||
        type === 'xcloudOfferReady' ||
        type === 'sendICEReady' ||
        type === 'sendKeepalive') &&
      !streamApi
    ) {
      log.error('Stream API not ready for message:', type);
      if (type === 'xcloudReady') {
        Alert.alert(
          t('Error'),
          t('Streaming is not ready yet. Please go back and try again.'),
        );
      }
      return;
    }
    if (type === 'xcloudReady') {
      const _settings = getSettings();

      streamApi
        .startSession(route.params?.sessionId, _settings.resolution)
        .then(configuration => {
          postData2Webview('startSessionEnd', configuration);
        })
        .catch(e => {
          // waitState rejects with '' when the session was stopped
          // mid-start. While an exit is already in progress that is
          // expected and stays silent; in every other case the start
          // has failed and the user must be told — silence would
          // leave this screen hanging on a dead picture forever.
          if (e === '' && isExiting) {
            return;
          }
          let msg = '';
          if (typeof e === 'string') {
            if (e.includes('WaitingForServerToRegister')) {
              msg =
                '[StartSession] Fail:' + t('WaitingForServerToRegister') + e;
            } else if (e !== '') {
              // e.g. 'Streaming failed' from an unknown session
              // state: show the reason itself instead of an alert
              // with an empty body.
              msg = '[StartSession] Fail:' + e;
            } else {
              msg = '[StartSession] Fail:' + t('Streaming is closed.');
            }
          } else {
            if (e?.message?.indexOf('400') > -1) {
              const error = t('noAllow');
              msg = '[StartSession] Fail:' + error;
            } else {
              msg = '[StartSession] Fail:' + ((e && e.message) || String(e));
            }
          }
          Alert.alert(t('Warning'), msg, [
            {
              text: t('Confirm'),
              style: 'default',
              onPress: () => {
                if (isExiting) {
                  return;
                }
                navigation.navigate('Home');
              },
            },
          ]);
        });
    }
    if (type === 'xcloudOfferReady') {
      // log.info('receive client offer:', message);
      // sendSdp
      streamApi
        .sendSDPOffer(message)
        .then(sdpResponse => {
          log.info('sdpResponse.exchangeResponse:', sdpResponse);
          const sdpDetails = JSON.parse(sdpResponse.exchangeResponse);
          postData2Webview('sendSDPOfferEnd', sdpDetails);
        })
        .catch(e => {
          Alert.alert(
            t('Warning'),
            '[sendSDPOffer] fail:' + ((e && e.message) || String(e)),
            [
              {
                text: t('Confirm'),
                style: 'default',
                onPress: () => {
                  handleExit();
                },
              },
            ],
          );
        });
    }
    if (type === 'sendICEReady') {
      log.info('sendICEReady');
      // SendICE
      streamApi
        .sendICECandidates(message)
        .then(candidates => {
          log.info('Client - ICE Candidates:', JSON.stringify(candidates));
          postData2Webview('sendIceEnd', candidates);
        })
        .catch(e => {
          Alert.alert(
            t('Warning'),
            '[sendICECandidates] fail:' + ((e && e.message) || String(e)),
            [
              {
                text: t('Confirm'),
                style: 'default',
                onPress: () => {
                  handleExit();
                },
              },
            ],
          );
        });
    }
    if (type === 'sendKeepalive') {
      log.info('sendKeepalive');
      streamApi
        .sendKeepalive()
        .then(result => {
          log.info('StartStream keepalive:', JSON.stringify(result));
        })
        .catch(error => {
          log.error(
            'Failed to send keepalive. Error details:\n',
            JSON.stringify(error),
          );
        });
    }
    if (type === 'streamingClosed') {
      // A late answer for a session whose exit already navigated
      // Home: its alert would pop over the Home screen and its
      // Confirm would run a second, redundant exit.
      if (exitedRef.current) {
        return;
      }
      // Arm the guard at PRESENTATION, not only when an exit begins:
      // a second streamingClosed arriving while this alert is up
      // would stack a duplicate that survives navigation to Home,
      // where its Confirm runs a second stopStream (and a duplicate
      // power-off, if the first exit was one).
      if (closedAlertShownRef.current) {
        return;
      }
      closedAlertShownRef.current = true;
      // The requestExit fallback timer is deliberately NOT cancelled
      // here: if a competing alert keeps this one from ever
      // presenting, its Confirm/onDismiss never run, and the fallback
      // is the only remaining way off the dead picture. Confirm below
      // cancels it; onDismiss replaces it.
      let closedConfirmPressed = false;
      Alert.alert(
        t('Warning'),
        t('Streaming is closed.'),
        [
          {
            text: t('Confirm'),
            style: 'default',
            onPress: () => {
              closedConfirmPressed = true;
              if (exitFallbackTimer.current) {
                clearTimeout(exitFallbackTimer.current);
                exitFallbackTimer.current = null;
              }
              handleExit();
            },
          },
        ],
        {
          onDismiss: () => {
            // Dismissed without Confirm (e.g. Android back): do not
            // strand the user on the dead picture — leave via the
            // same fallback timer the Disconnect path uses.
            if (!closedConfirmPressed) {
              if (exitFallbackTimer.current) {
                clearTimeout(exitFallbackTimer.current);
              }
              exitFallbackTimer.current = setTimeout(() => {
                handleExit();
              }, 2000);
            }
          },
        },
      );
    }
    if (type === 'deviceVibration') {
      const {rumbleData} = message || {};
      if (!rumbleData) {
        return;
      }
      if (rumbleData.strongMagnitude === 0 && rumbleData.weakMagnitude === 0) {
        Vibration.cancel();
      } else {
        Vibration.vibrate(rumbleData.duration / 10);
      }
    }
    if (type === 'nativeVibration') {
      const {rumbleData} = message || {};
      if (!rumbleData) {
        return;
      }
      let weakMagnitude = rumbleData.weakMagnitude * 65535;
      let strongMagnitude = rumbleData.strongMagnitude * 65535;
      let leftTrigger = rumbleData.leftTrigger * 65535;
      let rightTrigger = rumbleData.rightTrigger * 65535;

      switch (settings.rumble_intensity) {
        case 1:
          weakMagnitude = weakMagnitude * 0.5;
          strongMagnitude = strongMagnitude * 0.4;
          break;
        case 2:
          weakMagnitude = weakMagnitude * 0.8;
          strongMagnitude = strongMagnitude * 0.9;
          break;
        case 4:
          weakMagnitude = weakMagnitude * 1.5;
          strongMagnitude = strongMagnitude * 2;
          break;
        case 5:
          weakMagnitude = weakMagnitude * 2;
          strongMagnitude = strongMagnitude * 2.5;
          break;
      }

      if (weakMagnitude > 65535) {
        weakMagnitude = 65535;
      }
      if (strongMagnitude > 65535) {
        strongMagnitude = 65535;
      }
      if (leftTrigger > 65535) {
        leftTrigger = 65535;
      }
      if (rightTrigger > 65535) {
        rightTrigger = 65535;
      }
      GamepadManager.rumble(
        rumbleData.duration,
        weakMagnitude,
        strongMagnitude,
        leftTrigger,
        rightTrigger,
      );
    }
    if (type === 'performance') {
      const oldPerf = performance;
      const perf = message;
      if (!perf || typeof perf !== 'object') {
        return;
      }

      if (oldPerf) {
        if (
          (!perf.br || perf.br === '--') &&
          oldPerf.br &&
          oldPerf.br !== '--'
        ) {
          perf.br = oldPerf.br;
        }
        if (
          (!perf.decode || perf.decode === '--') &&
          oldPerf.decode &&
          oldPerf.decode !== '--'
        ) {
          perf.decode = oldPerf.decode;
        }
      }
      setPerformance(perf);
    }
    if (type === 'connectionstate') {
      setConnectState(message);
      if (message === CONNECTED) {
        if (!connectedToastRef.current) {
          connectedToastRef.current = true;
          setToastText(t('Connected'));
        }
        // Show the tips modal once per stream: a renegotiation can make
        // the page report 'connected' again, and the modal must not pop
        // up over the game a second time.
        if (!tipsShownRef.current) {
          tipsShownRef.current = true;
          setShowTipsModal(true);
        }
      }
      // Alway show virtual gamepad
      if (message === CONNECTED && settings.show_virtual_gamead) {
        setShowVirtualGamepad(true);
      }

      // Alway show performance
      if (message === CONNECTED && settings.show_performance) {
        setShowPerformance(true);

        if (settings.gamepad_kernal === 'Web') {
          handleToggleWebviewPerformance(true);
        }
      }
    }
    if (type === 'exit') {
      handleExit();
    }
    if (type === 'timeoutExit') {
      /* Timeout, almost is connectionstate is failed,
         this situation we should refresh all tokens to make new connection.
       */
      handleTimeoutExit();
    }
  };

  const handleToggleWebviewPerformance = next => {
    // Take the target value explicitly: callers set state and toggle in the
    // same tick, so reading showPerformance here would use a stale value.
    if (next) {
      postData2Webview('showPerformance', {});
    } else {
      postData2Webview('hidePerformance', {});
    }
  };

  const applyAspectToVideo = fit => {
    if (webviewRef.current) {
      webviewRef.current.injectJavaScript(
        `(function(){var v=document.querySelector('video');if(v){v.style.objectFit='${fit}';v.style.width='100%';v.style.height='100%';}true;})()`,
      );
    }
  };

  const handleSetAspect = (format, fit) => {
    const next = {...settings, video_format: format};
    setSettings(next);
    saveSettings(next);
    applyAspectToVideo(fit);
    handleCloseModal();
  };

  const handleSetResolution = value => {
    const next = {...settings, resolution: value};
    setSettings(next);
    saveSettings(next);
    handleCloseModal();
  };

  // Virtual gamepad press. The 50 ms delayed release is tracked per
  // button: a re-press inside that window cancels the pending
  // zeroing — the old untracked timer fired anyway and released a
  // button the user was already holding again.
  const pressOutTimers = React.useRef({});
  const handleButtonPressIn = name => {
    if (pressOutTimers.current[name]) {
      clearTimeout(pressOutTimers.current[name]);
      delete pressOutTimers.current[name];
    }
    gpState[name] = 1;
  };

  const handleButtonPressOut = name => {
    if (pressOutTimers.current[name]) {
      clearTimeout(pressOutTimers.current[name]);
    }
    pressOutTimers.current[name] = setTimeout(() => {
      delete pressOutTimers.current[name];
      gpState[name] = 0;
    }, 50);
  };

  // Virtual gamepad move joystick
  const handleStickMove = (id, data) => {
    // console.log('handleStickMove:', id, data);
    let leveledX = data.dist.x;
    let leveledY = data.dist.y;

    // Normalize strings to numbers: toFixed is a Number method, so the
    // old "fix-up" (calling it on a string) would itself have thrown.
    if (typeof leveledX === 'string') {
      leveledX = parseFloat(leveledX) || 0;
    }
    if (typeof leveledY === 'string') {
      leveledY = parseFloat(leveledY) || 0;
    }

    if (id === 'right') {
      gpState.RightThumbXAxis = Number(leveledX);
      gpState.RightThumbYAxis = Number(-leveledY);
    } else {
      gpState.LeftThumbXAxis = Number(leveledX);
      gpState.LeftThumbYAxis = Number(-leveledY);
    }
  };

  const requestVirtualGamepad = () => {
    // Close
    if (showVirtualGamepad) {
      setShowVirtualGamepad(false);
      if (settings.gamepad_kernal !== 'Native') {
        timer.current && clearInterval(timer.current);
      }
    } else {
      setShowVirtualGamepad(true);
      if (settings.gamepad_kernal !== 'Native') {
        timer.current = setInterval(() => {
          postData2Webview('gamepad', gpState);
        }, 4);
      }
    }
  };

  const requestExit = () => {
    setShowPerformance(false);
    setShowVirtualGamepad(false);
    postData2Webview('disconnect', {});
    setShowModal(false);
    // If the WebView never answers with streamingClosed/exit, leave via
    // handleExit anyway instead of stranding the user on a dead picture.
    // If it DOES answer, the streamingClosed alert takes over the exit
    // and this timer stands down when it fires (below).
    if (exitFallbackTimer.current) {
      clearTimeout(exitFallbackTimer.current);
    }
    exitFallbackTimer.current = setTimeout(() => {
      exitFallbackTimer.current = null;
      // The streamingClosed alert is up: it owns the exit from here
      // (its Confirm and onDismiss both lead to handleExit). Firing
      // handleExit underneath it would leave the alert floating over
      // Home, where its callbacks would attempt a second exit.
      if (closedAlertShownRef.current) {
        return;
      }
      handleExit();
    }, 2000);
  };

  const background = {
    borderless: false,
    color: 'rgba(255, 255, 255, 0.2)',
    foreground: true,
  };

  const handleDisplayOptionsChange = React.useCallback(
    options => {
      postData2Webview('refreshVideo', options);
      const next = {...settings, display_options: options};
      setSettings(next);
      saveSettings(next);
    },
    [settings],
  );

  const renderVirtualGamepad = () => {
    if (!showVirtualGamepad) {
      return null;
    }
    const useCustomVirtualGamepad = settings.custom_virtual_gamepad !== '';
    if (useCustomVirtualGamepad) {
      return (
        <CustomVirtualGamepad
          title={settings.custom_virtual_gamepad}
          opacity={settings.virtual_gamepad_opacity}
          onPressIn={handleButtonPressIn}
          onPressOut={handleButtonPressOut}
          onStickMove={handleStickMove}
        />
      );
    } else {
      return (
        <VirtualGamepad
          opacity={settings.virtual_gamepad_opacity}
          onPressIn={handleButtonPressIn}
          onPressOut={handleButtonPressOut}
          onStickMove={handleStickMove}
        />
      );
    }
  };

  return (
    <>
      {showPerformance && settings.gamepad_kernal === 'Native' && (
        <PerfPanel performance={performance} />
      )}

      {renderVirtualGamepad()}

      <Portal>
        <Modal
          visible={showDisplayModal}
          onDismiss={() => {
            setShowDisplayModal(false);
          }}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <Display
                options={settings.display_options}
                onChange={handleDisplayOptionsChange}
              />
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={showTipsModal}
          onDismiss={() => setShowTipsModal(false)}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <Text style={{textAlign: 'center'}}>{t('stream_warn_text')}</Text>
              <Button
                style={{marginTop: 10}}
                onPress={() => setShowTipsModal(false)}>
                {t('Confirm')}
              </Button>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={showMessageModal}
          onDismiss={() => {
            setShowMessageModal(false);
          }}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <TextInput
                label={t('Text')}
                value={message}
                onChangeText={text => setMessage(text)}
              />
              <Button
                mode="contained"
                loading={messageSending}
                style={{marginTop: 10}}
                onPress={handleSendMessage}>
                {t('Send')}
              </Button>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => handleCloseModal()}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <ScrollView style={{maxHeight: modalMaxHeight}}>
                <List.Section>
                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Toggle Stats')}
                      background={background}
                      onPress={() => {
                        const next = !showPerformance;
                        setShowPerformance(next);
                        if (settings.gamepad_kernal === 'Web') {
                          handleToggleWebviewPerformance(next);
                          webviewRef.current &&
                            webviewRef.current.requestFocus();
                        }
                        handleCloseModal();
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Aspect ratio') + ': ' + t('Fit')}
                      background={background}
                      onPress={() => {
                        handleSetAspect('', 'contain');
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Aspect ratio') + ': ' + t('Stretch')}
                      background={background}
                      onPress={() => {
                        handleSetAspect('Stretch', 'fill');
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Aspect ratio') + ': ' + t('Zoom')}
                      background={background}
                      onPress={() => {
                        handleSetAspect('Zoom', 'cover');
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Resolution: 720P (next stream)')}
                      background={background}
                      onPress={() => {
                        handleSetResolution(720);
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Resolution: 1080P (next stream)')}
                      background={background}
                      onPress={() => {
                        handleSetResolution(1080);
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Resolution: 1080P HQ (next stream)')}
                      background={background}
                      onPress={() => {
                        handleSetResolution(1081);
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Display')}
                      background={background}
                      onPress={() => {
                        setShowDisplayModal(true);
                        handleCloseModal();
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Toggle Virtual Gamepad')}
                      background={background}
                      onPress={() => {
                        requestVirtualGamepad();
                        handleCloseModal();
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={t('Press Nexus')}
                      background={background}
                      onPress={() => {
                        gpState.Nexus = 1;
                        setTimeout(() => {
                          gpState.Nexus = 0;
                        }, 120);
                        handleCloseModal();
                      }}
                    />
                  )}
                  {connectState === CONNECTED &&
                    route.params?.streamType !== 'cloud' && (
                      <List.Item
                        title={t('Long press Nexus')}
                        background={background}
                        onPress={() => {
                          gpState.Nexus = 1;
                          setTimeout(() => {
                            gpState.Nexus = 0;
                          }, 1000);
                          handleCloseModal();
                        }}
                      />
                    )}

                  {connectState === CONNECTED &&
                    route.params?.streamType !== 'cloud' && (
                      <List.Item
                        title={t('Send text')}
                        background={background}
                        onPress={() => {
                          setShowMessageModal(true);
                          handleCloseModal();
                        }}
                      />
                    )}

                  {connectState === CONNECTED &&
                    settings.power_on &&
                    route.params?.streamType !== 'cloud' && (
                      <List.Item
                        title={t('Disconnect and power off')}
                        background={background}
                        onPress={() => {
                          needPoweroffRef.current = true;
                          requestExit();
                        }}
                      />
                    )}

                  <List.Item
                    title={t('Disconnect')}
                    background={background}
                    onPress={requestExit}
                  />
                  <List.Item
                    title={t('Cancel')}
                    background={background}
                    onPress={() => handleCloseModal()}
                  />
                </List.Section>
              </ScrollView>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <View style={styles.quickMenu}>
        <IconButton
          icon="menu"
          size={28}
          onPress={() => {
            setShowModal(true);
          }}
        />
      </View>

      <View style={{flex: 1}}>
        {webviewError && (
          <View style={styles.webviewError}>
            <Text style={styles.webviewErrorText}>
              {t('The stream page failed to load. Please go back and try again.')}
            </Text>
            <Button mode="contained" onPress={handleExit}>
              {t('Disconnect')}
            </Button>
          </View>
        )}
        {showWebview && !webviewError && (
          <WebView
            ref={instance => {
              webviewRef.current = instance;
            }}
            source={{uri}}
            originWhitelist={['*']}
            javaScriptEnabled={true}
            cacheEnabled={false}
            setSupportMultipleWindows={false}
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo={true}
            allowsInlineMediaPlayback={true}
            androidLayerType={'hardware'}
            injectedJavaScriptObject={{
              settings,
              streamType: route.params?.streamType,
            }}
            onMessage={event => {
              handleWebviewMessage(event);
            }}
            onError={syntheticEvent => {
              const {nativeEvent} = syntheticEvent;
              console.warn('WebView error: ', nativeEvent);
              // A failed stream page used to leave a silent black
              // screen; show an error with a way out instead.
              setWebviewError(true);
            }}
          />
        )}
      </View>

      <Snackbar
        visible={toastText !== ''}
        onDismiss={() => setToastText('')}
        duration={1500}>
        {toastText}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  modal: {
    // backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginLeft: '32%',
    marginRight: '32%',
  },
  quickMenu: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    zIndex: 10,
  },
  webviewError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webviewErrorText: {
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
});

export default StreamScreen;
