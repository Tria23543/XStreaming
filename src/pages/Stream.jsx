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
  const [needPoweroff, setNeedPoweroff] = React.useState(false);
  const [modalMaxHeight, setModalMaxHeight] = React.useState(250);
  const [message, setMessage] = React.useState('');
  const [messageSending, setMessageSending] = React.useState(false);
  const [toastText, setToastText] = React.useState('');

  const controllerEventListener = React.useRef(undefined);
  const timer = React.useRef(undefined);
  const isRightstickMoving = React.useRef(false);

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
          console.log('native controller:', params);
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
    if (streamingTokens.xHomeToken) {
      const region = streamingTokens.xHomeToken.getDefaultRegion();
      if (region) {
        const _xHomeApi = new XcloudApi(
          region.baseUri,
          streamingTokens.xHomeToken.data.gsToken,
          'home',
          authentication,
        );
        setXHomeApi(_xHomeApi);
      }
    }
    if (streamingTokens.xCloudToken) {
      const region = streamingTokens.xCloudToken.getDefaultRegion();
      if (region) {
        const _xCloudApi = new XcloudApi(
          region.baseUri,
          streamingTokens.xCloudToken.data.gsToken,
          'cloud',
          authentication,
        );
        setXCloudApi(_xCloudApi);
      }
    }

    setTimeout(() => {
      Orientation.lockToLandscape();

      setTimeout(() => {
        const {height: dHeight} = Dimensions.get('window');
        setModalMaxHeight(dHeight - 50);
        setShowWebview(true);
        setTimeout(() => {
          webviewRef.current && webviewRef.current.requestFocus();
        }, 100);
      }, 800);
    }, 500);

    return () => {
      Orientation.unlockAllOrientations();
      timer.current && clearInterval(timer.current);
      controllerEventListener.current &&
        controllerEventListener.current.remove();
    };
  }, [
    route.params?.sessionId,
    route.params?.streamType,
    streamingTokens,
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

  const handlePowerOff = async () => {
    const webApi = new WebApi(webToken);
    const powerOffRes = await webApi.powerOff(route.params?.sessionId);
    console.log('powerOff:', powerOffRes);
  };

  const handleSendMessage = async () => {
    const webApi = new WebApi(webToken);
    setMessageSending(true);
    let text = message.trim();
    if (text.length > 100) {
      text = text.substring(0, 100);
    }
    try {
      await webApi.sendText(route.params?.sessionId, text);
      setMessage('');
      setToastText(t('Sent'));
    } catch (e) {
      setToastText(t('Failed to send'));
    }
    setMessageSending(false);
  };

  const handleExit = () => {
    if (isExiting) {
      return;
    }
    setIsExiting(true);
    const finishExit = () => {
      if (needPoweroff) {
        handlePowerOff();
      }
      setTimeout(() => {
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
    const finishTimeoutExit = () => {
      authentication._tokenStore &&
        authentication._tokenStore.clearTokenUpdateTime();
      setTimeout(() => {
        RNRestart.restart();
      }, 100);
    };
    if (!streamApi) {
      finishTimeoutExit();
      return;
    }
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
    const data = JSON.parse(event.nativeEvent.data);
    const {type, message} = data;
    console.log('handleWebviewMessage type:', type);
    console.log('handleWebviewMessage message:', message);
    if (type === 'other') {
      Alert.alert(message);
    }
    if (type === 'xcloudReady') {
      const _settings = getSettings();
      log.info('Get localSettings:', _settings);

      streamApi
        .startSession(route.params?.sessionId, _settings.resolution)
        .then(configuration => {
          console.log('*****startSessionEnd:', configuration);
          postData2Webview('startSessionEnd', configuration);
        })
        .catch(e => {
          if (e !== '') {
            let msg = '';
            if (typeof e === 'string') {
              if (e.includes('WaitingForServerToRegister')) {
                msg =
                  '[StartSession] Fail:' + t('WaitingForServerToRegister') + e;
              }
            } else {
              if (e.message?.indexOf('400') > -1) {
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
          }
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
      Alert.alert(t('Warning'), 'Streaming is closed.', [
        {
          text: t('Confirm'),
          style: 'default',
          onPress: () => {
            handleExit();
          },
        },
      ]);
    }
    if (type === 'deviceVibration') {
      const {rumbleData} = message;
      if (rumbleData.strongMagnitude === 0 || rumbleData.weakMagnitude === 0) {
        Vibration.cancel();
      } else {
        Vibration.vibrate(rumbleData.duration / 10);
      }
    }
    if (type === 'nativeVibration') {
      const {rumbleData} = message;
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
        setToastText(t('Connected'));
        setShowTipsModal(true);
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
    settings.video_format = format;
    saveSettings(settings);
    applyAspectToVideo(fit);
    handleCloseModal();
  };

  const handleSetResolution = value => {
    settings.resolution = value;
    saveSettings(settings);
    handleCloseModal();
  };

  // Virtual gamepad press
  const handleButtonPressIn = name => {
    // console.log('handleButtonPressIn:', name);
    gpState[name] = 1;
    // if (settings.vibration) {
    //   Vibration.vibrate(3);
    // }
  };

  const handleButtonPressOut = name => {
    setTimeout(() => {
      // console.log('handleButtonPressOut:', name);
      gpState[name] = 0;
    }, 50);
  };

  // Virtual gamepad move joystick
  const handleStickMove = (id, data) => {
    // console.log('handleStickMove:', id, data);
    let leveledX = data.dist.x;
    let leveledY = data.dist.y;

    if (typeof leveledX === 'string') {
      leveledX = leveledX.toFixed(2);
    }
    if (typeof leveledY === 'string') {
      leveledY = leveledY.toFixed(2);
    }

    if (id === 'right') {
      if (Math.abs(leveledX) > 0 || Math.abs(leveledY) > 0) {
        isRightstickMoving.current = true;
      } else {
        isRightstickMoving.current = false;
      }
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
  };

  const background = {
    borderless: false,
    color: 'rgba(255, 255, 255, 0.2)',
    foreground: true,
  };

  const handleDisplayOptionsChange = React.useCallback(
    options => {
      postData2Webview('refreshVideo', options);
      settings.display_options = options;
      // setSettings(settings);
      saveSettings(settings);
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
                      title={t('Aspect ratio') + ': Fit'}
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
                      title={'Resolution: 720P (next stream)'}
                      background={background}
                      onPress={() => {
                        handleSetResolution(720);
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={'Resolution: 1080P (next stream)'}
                      background={background}
                      onPress={() => {
                        handleSetResolution(1080);
                      }}
                    />
                  )}

                  {connectState === CONNECTED && (
                    <List.Item
                      title={'Resolution: 1080P HQ (next stream)'}
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
                          setNeedPoweroff(true);
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
        {showWebview && (
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
  card: {
    width: 300,
    padding: 5,
  },
  modal: {
    // backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginLeft: '32%',
    marginRight: '32%',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  title: {
    paddingBottom: 10,
  },
  content: {
    paddingTop: 10,
  },
  quickMenu: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    zIndex: 10,
  },
});

export default StreamScreen;
