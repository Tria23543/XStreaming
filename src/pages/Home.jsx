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
  const [profile, setProfile] = React.useState(null);
  const [consoles, setConsoles] = React.useState([]);
  const [isConnected, setIsConnected] = React.useState(true);
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

  // Latest known connectivity, readable inside async callbacks whose
  // closures predate the latest NetInfo event.
  const isConnectedRef = React.useRef(true);
  // The Authentication instance below is constructed once and keeps
  // the first effect run's callbacks forever; those callbacks must
  // translate through the CURRENT language, not the one captured at
  // construction time.
  const tRef = React.useRef(t);
  tRef.current = t;
  // The login redirect URL already consumed by the auth flow. Route
  // params are never cleared, so without this any later effect re-run
  // (e.g. a connectivity flap) would re-enter the interactive flow
  // with the same, already-consumed auth code.
  const consumedXalUrlRef = React.useRef(null);
  // Set when the needRefresh param has just been consumed: clearing
  // the param with setParams re-runs the main effect, and that re-run
  // must not start a second full sign-in check on top of the refresh
  // the first run just did.
  const skipNextAuthCheckRef = React.useRef(false);

  const dispatch = useDispatch();

  const isFocused = useIsFocused();
  const _isFocused = React.useRef(isFocused);
  // Keep the ref in sync: it used to be frozen at its mount value, so
  // the auth/console flow would never have run if the screen had ever
  // mounted unfocused. The ref only GATES alerts and branches inside
  // runs triggered by the effect's real deps — a focus change by
  // itself does not re-run the flow.
  React.useEffect(() => {
    _isFocused.current = isFocused;
  }, [isFocused]);

  const [fabOpen, setFabOpen] = React.useState(false);

  React.useEffect(() => {
    log.info('Page loaded.');
    SplashScreen.hide();

    const updateLayout = () => {
      const {width, height} = Dimensions.get('window');
      setNumColumns(width > height ? 4 : 2);
    };

    updateLayout();
    const subscription = Dimensions.addEventListener('change', updateLayout);

    // Seed connectivity from a one-off fetch as well as the listener:
    // until the first event lands the state still claims "online",
    // and a sign-in failure inside that window could be misread as a
    // token problem. And treat NetInfo's null (unknown) as connected:
    // unknown is not offline.
    NetInfo.fetch()
      .then(state => {
        const connected = state.isConnected !== false;
        isConnectedRef.current = connected;
        setIsConnected(connected);
      })
      .catch(() => {});

    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected !== false;
      isConnectedRef.current = connected;
      setIsConnected(connected);
    });

    // One cleanup for every exit path of this effect. Returning partial
    // cleanups (or none, on the offline path) leaks the other listener
    // on every run.
    const cleanupListeners = () => {
      subscription?.remove();
      unsubscribe();
    };

    if (!isConnected) {
      // Home stays mounted under the other tabs: a global alert raised
      // from here would pop over whatever screen the user is actually
      // looking at. Warn only when Home is the visible screen.
      if (_isFocused.current) {
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
      }
      return cleanupListeners;
    }

    const promptLogin = () => {
      _authentication.current._xal
        .getRedirectUri()
        .then(redirectObj => {
          setLoading(false);
          // Never log the redirect object: it carries the Sisu
          // SessionId and the OAuth URL (state / code_challenge).
          log.info('Login redirect received');
          _redirect.current = redirectObj;
          dispatch({
            type: 'SET_REDIRECT',
            payload: redirectObj,
          });
          // Same focus rule as the offline warning: if the user has
          // moved to another tab, do not throw a modal over it. The
          // stored redirect keeps the standalone Login button on this
          // screen working when they come back.
          if (!_isFocused.current) {
            return;
          }
          Alert.alert(
            tRef.current('Warning'),
            tRef.current('Login has expired or not logged in, please log in again'),
            [
              {
                text: tRef.current('Later'),
                style: 'cancel',
              },
              {
                text: tRef.current('Confirm'),
                style: 'default',
                onPress: () => {
                  const authUrl = redirectObj?.sisuAuth?.MsaOauthRedirect;
                  if (authUrl) {
                    navigation.navigate('Login', {authUrl});
                  } else {
                    Alert.alert(
                      tRef.current('Error'),
                      tRef.current(
                        'Currently no network connection, please connect and try again',
                      ),
                    );
                  }
                },
              },
            ],
          );
        })
        .catch(e => {
          setLoading(false);
          // Offline, getRedirectUri fails because there is no network:
          // the offline warning already says exactly that, so do not
          // stack a second alert carrying the raw network error.
          if (isConnectedRef.current) {
            Alert.alert(tRef.current('Error'), (e && e.message) || String(e));
          }
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

        setLoadingText(tRef.current('Fetching user info...'));
        try {
          const _profile = await webApi.getUserProfile();
          setProfile(_profile);
          dispatch({
            type: 'SET_PROFILE',
            payload: _profile,
          });
          setLoadingText(tRef.current('Fetching consoles...'));
          const _consoles = await webApi.getConsoles();
          setConsoles(_consoles);
        } catch (e) {
          // Home stays mounted under the other tabs: raise the alert
          // only when Home is the visible screen.
          if (_isFocused.current) {
            Alert.alert(tRef.current('Error'), (e && e.message) || String(e));
          } else {
            log.error('Fetch user info error:', (e && e.message) || e);
          }
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
      if (
        route.params?.xalUrl &&
        consumedXalUrlRef.current !== route.params.xalUrl
      ) {
        consumedXalUrlRef.current = route.params.xalUrl;
        if (!_isLogined.current) {
          // Never log the redirect URL itself: it carries the auth code.
          log.info('HomeScreen received a login redirect');
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
        // Consume the flag: left in the route params it would re-fetch
        // the consoles on every later effect re-run.
        skipNextAuthCheckRef.current = true;
        navigation.setParams({needRefresh: undefined});
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
      } else if (skipNextAuthCheckRef.current) {
        // This run exists only because the needRefresh branch above
        // cleared its param: the refresh it just did IS this run's
        // work — a second full sign-in check on top of it would
        // double the token and console requests on every stream exit.
        skipNextAuthCheckRef.current = false;
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
            if (_isFocused.current) {
              Alert.alert(t('Error'), (e && e.message) || String(e));
            } else {
              log.error('Check authentication error:', (e && e.message) || e);
            }
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
    handleNavigateStream(sessionId);
  };

  const handleNavigateStream = async sessionId => {
    // Stream reads the settings itself via getSettings(); the settings
    // param that used to be passed here was never read.
    navigation.navigate({
      name: 'Stream',
      params: {
        sessionId,
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
      // The Profile action only exists when a profile actually loaded:
      // with a null profile the modal renders nothing, so the button
      // looked completely dead after a failed profile fetch.
      ...(profile
        ? [
            {
              icon: 'information',
              label: t('Profile'),
              onPress: () => {
                setFabOpen(false);
                setShowProfile(true);
              },
            },
          ]
        : []),
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
          {_redirect.current?.sisuAuth?.MsaOauthRedirect && (
            <Button
              mode="contained"
              style={{marginTop: 16}}
              onPress={() => {
                const authUrl = _redirect.current?.sisuAuth?.MsaOauthRedirect;
                if (authUrl) {
                  navigation.navigate('Login', {authUrl});
                }
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
  noConsoles: {
    padding: 20,
  },
  consoleList: {
    paddingTop: 20,
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 10,
  },
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
