import React from 'react';
import {
  StyleSheet,
  View,
  Alert,
  FlatList,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import {Text, FAB, Portal, Modal, Card, Button} from 'react-native-paper';
import {useIsFocused} from '@react-navigation/native';
import ConsoleItem from '../components/ConsoleItem';
import Profile from '../components/Profile';
import {getSettings} from '../store/settingStore';

import Authentication from '../Authentication';
import WebApi from '../web';

import {useSelector, useDispatch} from 'react-redux';
import SplashScreen from 'react-native-splash-screen';
import {useTranslation} from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';
import {debugFactory} from '../utils/debug';

const log = debugFactory('HomeScreen');

function HomeScreen({navigation, route}) {
  const {t} = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const [loadingText, setLoadingText] = React.useState('');
  const [xalUrl, setXalUrl] = React.useState('');
  const [profile, setProfile] = React.useState(null);
  const [consoles, setConsoles] = React.useState([]);
  const [isConnected, setIsConnected] = React.useState(true);
  const [currentConsoleId, setCurrentConsoleId] = React.useState('');
  const [numColumns, setNumColumns] = React.useState(2);
  const [showProfile, setShowProfile] = React.useState(false);

  const authentication = useSelector(state => state.authentication);
  const _authentication = React.useRef(authentication);

  const redirect = useSelector(state => state.redirect);
  const _redirect = React.useRef(redirect);

  const isLogined = useSelector(state => state.isLogined);
  const _isLogined = React.useRef(isLogined);
  // Set by the authenticationFailed callback when it has already shown
  // the login prompt, so checkAuthentication resolving false for the
  // same failure does not prompt a second time.
  const _authPromptHandled = React.useRef(false);

  const webToken = useSelector(state => state.webToken);
  const webTokenRef = React.useRef(null);

  const dispatch = useDispatch();

  const isFocused = useIsFocused();
  const _isFocused = React.useRef(isFocused);

  const [fabOpen, setFabOpen] = React.useState(false);

  // React.useEffect(() => {
  //   log.info('Page loaded.');
  //   SplashScreen.hide();
  // });

  React.useEffect(() => {
    log.info('Page loaded.');
    SplashScreen.hide();

    const updateLayout = () => {
      const {width, height} = Dimensions.get('window');
      setNumColumns(width > height ? 4 : 2);
    };

    updateLayout();
    const subscription = Dimensions.addEventListener('change', updateLayout);

    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    // One cleanup for every exit path of this effect. Returning partial
    // cleanups (or none, on the offline path) leaks the other listener
    // on every run.
    const cleanupListeners = () => {
      subscription?.remove();
      unsubscribe();
    };

    if (!isConnected) {
      Alert.alert(
        t('Warning'),
        t('Currently no network connection, please connect and try again'),
        [
          {
            text: t('Confirm'),
            style: 'default',
            onPress: () => {},
          },
        ],
      );
      return cleanupListeners;
    }

    const promptLogin = () => {
      _authentication.current._xal
        .getRedirectUri()
        .then(redirectObj => {
          setLoading(false);
          log.info('Redirect:', redirectObj);
          _redirect.current = redirectObj;
          dispatch({
            type: 'SET_REDIRECT',
            payload: redirectObj,
          });
          Alert.alert(
            t('Warning'),
            t('Login has expired or not logged in, please log in again'),
            [
              {
                text: t('Later'),
                style: 'cancel',
              },
              {
                text: t('Confirm'),
                style: 'default',
                onPress: () => {
                  navigation.navigate('Login', {
                    authUrl: redirectObj.sisuAuth.MsaOauthRedirect,
                  });
                },
              },
            ],
          );
        })
        .catch(e => {
          setLoading(false);
          Alert.alert(t('Error'), (e && e.message) || String(e));
        });
    };

    if (!_authentication.current) {
      log.info('Authentication initial.');
      const authenticationFailed = () => {
        // Silent refresh failed (the saved tokens are kept; the user can
        // retry or log in fresh) or an interactive login was cancelled.
        // Never leave the page stuck on the loading spinner: drop back
        // to the login prompt.
        _authPromptHandled.current = true;
        dispatch({
          type: 'SET_LOGIN',
          payload: false,
        });
        _isLogined.current = false;
        setLoading(false);
        promptLogin();
      };
      const authenticationCompleted = async (_streamingTokens, _webToken) => {
        log.info('Authentication completed');
        webTokenRef.current = _webToken;
        // Re-apply the user's saved signal-server choices, because fresh
        // streaming tokens always start from Microsoft's default region.
        const _savedSettings = getSettings();
        if (_streamingTokens?.xCloudToken && _savedSettings.signaling_cloud) {
          _streamingTokens.xCloudToken.setDefaultRegion(
            _savedSettings.signaling_cloud,
          );
        }
        if (_streamingTokens?.xHomeToken && _savedSettings.signaling_home) {
          _streamingTokens.xHomeToken.setDefaultRegion(
            _savedSettings.signaling_home,
          );
        }
        // log.info('AuthenticationCompleted streamingTokens:', streamingTokens);
        dispatch({
          type: 'SET_STREAMING_TOKEN',
          payload: _streamingTokens,
        });
        dispatch({
          type: 'SET_WEB_TOKEN',
          payload: _webToken,
        });
        dispatch({
          type: 'SET_LOGIN',
          payload: true,
        });
        _isLogined.current = true;

        setLoading(true);
        const webApi = new WebApi(_webToken);

        setLoadingText(t('Fetching user info...'));
        try {
          const _profile = await webApi.getUserProfile();
          setProfile(_profile);
          dispatch({
            type: 'SET_PROFILE',
            payload: _profile,
          });
          setLoadingText(t('Fetching consoles...'));
          const _consoles = await webApi.getConsoles();
          setConsoles(_consoles);
        } catch (e) {
          Alert.alert(t('Error'), (e && e.message) || String(e));
        }
        setLoading(false);
      };

      _authentication.current = new Authentication(
        authenticationCompleted,
        authenticationFailed,
      );
      dispatch({
        type: 'SET_AUTHENTICATION',
        payload: _authentication.current,
      });
    }

    if (_isFocused.current) {
      log.info('HomeScreen isFocused:', _isFocused.current);

      // Return from Login screen
      if (route.params?.xalUrl) {
        if (!_isLogined.current) {
          // Never log the redirect URL itself: it carries the auth code.
          log.info('HomeScreen received a login redirect');
          setXalUrl(route.params.xalUrl);
          setLoading(true);
          setLoadingText(
            t('Login successful, refreshing login credentials...'),
          );
          _authentication.current.startAuthflow(
            _redirect.current,
            route.params.xalUrl,
          );
        }
      } else if (route.params?.needRefresh && webTokenRef.current) {
        setLoading(true);
        setLoadingText(t('Fetching consoles...'));
        const webApi = new WebApi(webTokenRef.current);
        webApi
          .getConsoles()
          .then(_consoles => {
            setConsoles(_consoles);
            setLoading(false);
          })
          .catch(e => {
            log.error('GetConsoles refresh error:', (e && e.message) || e);
            setLoading(false);
          });
      } else {
        setLoading(true);
        setLoadingText(t('Checking login status...'));
        _authPromptHandled.current = false;
        _authentication.current
          .checkAuthentication()
          .then(isAuth => {
            dispatch({
              type: 'SET_AUTHENTICATION',
              payload: _authentication.current,
            });
            // If the silent flow failed, authenticationFailed has
            // already shown the login prompt for this failure.
            if (!isAuth && !_authPromptHandled.current) {
              promptLogin();
            }
          })
          .catch(e => {
            Alert.alert(t('Error'), (e && e.message) || String(e));
          });
      }

      return cleanupListeners;
    }

    return cleanupListeners;
  }, [
    t,
    route.params?.xalUrl,
    route.params?.needRefresh,
    dispatch,
    navigation,
    isConnected,
  ]);

  const handlePoweronAndStream = async sessionId => {
    setLoading(true);
    setLoadingText(t('Loading...'));
    const webApi = new WebApi(webToken);
    try {
      const powerOnRes = await webApi.powerOn(sessionId);
      log.info('powerOn:', powerOnRes);

      const _consoles = await webApi.getConsoles();
      setConsoles(_consoles);

      setLoading(false);

      handleStartStream(sessionId);
    } catch (e) {
      // Power-on (or the console refresh) failed; still try the stream,
      // but leave a trace so a later failure is diagnosable.
      log.error('Power on and stream error:', (e && e.message) || e);
      setLoading(false);

      handleStartStream(sessionId);
    }
  };

  const handleStartStream = async sessionId => {
    setCurrentConsoleId(sessionId);
    handleNavigateStream(sessionId);
  };

  const handleNavigateStream = async sessionId => {
    const settings = getSettings();

    navigation.navigate({
      name: 'Stream',
      params: {
        sessionId,
        settings,
      },
    });
  };

  const renderProfile = () => {
    if (!showProfile || !profile) {
      return null;
    }
    return (
      <Portal>
        <Modal
          visible={showProfile}
          onDismiss={() => {
            setShowProfile(false);
          }}
          contentContainerStyle={{marginLeft: '10%', marginRight: '10%'}}>
          <Card>
            <Card.Content>
              <Profile profile={profile} />
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    );
  };

  const renderFab = () => {
    const fabActions = [
      {
        icon: 'information',
        label: t('Profile'),
        onPress: () => {
          setFabOpen(false);
          setShowProfile(true);
        },
      },
      {
        icon: 'account-supervisor',
        label: t('Friends'),
        onPress: () => navigation.navigate('Friends'),
      },
      {
        icon: 'trophy',
        label: t('Achievements'),
        onPress: () => navigation.navigate('Achievements'),
      },
    ];

    if (!isLogined) {
      return null;
    }

    return (
      <FAB.Group
        open={fabOpen}
        visible
        icon={fabOpen ? 'account-circle' : 'account-circle-outline'}
        actions={fabActions}
        onStateChange={({open}) => setFabOpen(open)}
      />
    );
  };

  const renderContent = () => {
    if (!isLogined) {
      if (loading) {
        return null;
      }
      return (
        <View style={styles.noConsoles}>
          <Text variant="titleMedium">{t('NoConsoles')}</Text>
          {_redirect.current && (
            <Button
              mode="contained"
              style={{marginTop: 16}}
              onPress={() => {
                navigation.navigate('Login', {
                  authUrl: _redirect.current.sisuAuth.MsaOauthRedirect,
                });
              }}>
              {t('Login')}
            </Button>
          )}
        </View>
      );
    }
    if (loading) {
      return null;
    }
    if (consoles.length) {
      return (
        <View>
          <View style={styles.consoleList}>
            <FlatList
              data={consoles}
              numColumns={numColumns}
              key={numColumns}
              keyExtractor={(item, index) => item.id || String(index)}
              contentContainerStyle={styles.listContainer}
              renderItem={({item}) => {
                return (
                  <View
                    style={[
                      styles.consoleItem,
                      numColumns === 4 ? styles.listItemH : styles.listItemV,
                    ]}>
                    <ConsoleItem
                      consoleItem={item}
                      onPress={() => handleStartStream(item.id)}
                      onPoweronStream={() => handlePoweronAndStream(item.id)}
                    />
                  </View>
                );
              }}
            />
          </View>
        </View>
      );
    } else {
      return (
        <View style={styles.noConsoles}>
          <Text variant="titleMedium">{t('NoConsoles')}</Text>
        </View>
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} renderToHardwareTextureAndroid>
      <View>
        {renderProfile()}

        {renderContent()}
      </View>
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#107C10" />
          <Text style={styles.spinnerTextStyle}>{loadingText}</Text>
        </View>
      )}
      {renderFab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spinnerTextStyle: {
    color: '#107C10',
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  menuWrap: {
    width: 250,
  },
  noConsoles: {
    padding: 20,
  },
  consoleList: {
    paddingTop: 20,
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 10,
  },
  listContainer: {},
  consoleItem: {
    padding: 10,
  },
  listItemH: {
    width: '25%',
    justifyContent: 'center',
  },
  listItemV: {
    width: '50%',
    justifyContent: 'center',
  },
});

export default HomeScreen;
