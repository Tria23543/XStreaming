import React from 'react';
import {View, StyleSheet, ActivityIndicator} from 'react-native';
import {Text, Button} from 'react-native-paper';
import {WebView} from 'react-native-webview';
import {useTranslation} from 'react-i18next';
import {debugFactory} from '../utils/debug';

const log = debugFactory('LoginScreen');

function LoginScreen({navigation, route}) {
  const {t} = useTranslation();
  const [authUrl, setAuthUrl] = React.useState('');
  const [loadError, setLoadError] = React.useState(false);
  const [pageLoading, setPageLoading] = React.useState(true);
  const [webviewKey, setWebviewKey] = React.useState(0);
  // False until the params effect has run once: before that, the
  // screen cannot yet know whether a login link is coming, and must
  // show a loader rather than the "no login link" error.
  const [paramsChecked, setParamsChecked] = React.useState(false);
  const redirectHandled = React.useRef(false);
  // The URL of the login document that most recently finished
  // loading (null while a load is in flight), and the WebView's
  // current main-frame URL as tracked from navigation state changes.
  // Http errors are judged against these: only a failure of the
  // document itself is fatal — a bare "a load ended" boolean cannot
  // tell a good document from an error page, and an extension test
  // cannot catch extensionless subresource failures.
  const loadedUrlRef = React.useRef(null);
  const currentUrlRef = React.useRef('');

  React.useEffect(() => {
    setParamsChecked(true);
    if (route.params?.authUrl) {
      // Do not write the full auth URL (it carries auth parameters) to logs.
      log.info('Receive authUrl');
      redirectHandled.current = false;
      loadedUrlRef.current = null;
      currentUrlRef.current = route.params?.authUrl;
      setLoadError(false);
      setAuthUrl(route.params?.authUrl);
    }
  }, [route.params?.authUrl]);

  const handleRedirect = url => {
    if (redirectHandled.current) {
      return;
    }
    redirectHandled.current = true;
    navigation.navigate({
      name: 'Home',
      params: {xalUrl: url},
      merge: true,
    });
  };

  if (authUrl !== '' && loadError) {
    return (
      <View style={styles.container}>
        <Text variant="titleMedium" style={styles.text}>
          {t(
            'The login page failed to load. Please check your connection and try again.',
          )}
        </Text>
        <Button
          mode="contained"
          onPress={() => {
            // Remount the WebView (new key) and try loading again,
            // instead of sending the user back to restart the whole
            // login prompt from Home.
            loadedUrlRef.current = null;
            currentUrlRef.current = authUrl;
            setLoadError(false);
            setWebviewKey(k => k + 1);
          }}>
          {t('Retry')}
        </Button>
        <Button
          mode="outlined"
          style={styles.secondButton}
          onPress={() => navigation.goBack()}>
          {t('Back')}
        </Button>
      </View>
    );
  }

  if (authUrl !== '') {
    return (
      <View style={styles.webviewWrap}>
        <WebView
          key={webviewKey}
          source={{uri: authUrl}}
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          onLoadStart={syntheticEvent => {
            loadedUrlRef.current = null;
            // The load event's own URL is the authoritative record
            // of the document now loading — independent of
            // navigation-state timing, which can lag a redirect hop.
            const startUrl =
              syntheticEvent &&
              syntheticEvent.nativeEvent &&
              syntheticEvent.nativeEvent.url;
            if (startUrl) {
              currentUrlRef.current = startUrl;
            }
            setPageLoading(true);
          }}
          onLoadEnd={syntheticEvent => {
            loadedUrlRef.current =
              (syntheticEvent &&
                syntheticEvent.nativeEvent &&
                syntheticEvent.nativeEvent.url) ||
              currentUrlRef.current ||
              null;
            setPageLoading(false);
          }}
          onError={() => setLoadError(true)}
          onHttpError={syntheticEvent => {
            // Only a failure of the login page ITSELF is fatal: this
            // callback also fires for subresource requests, and one
            // failed asset or XHR — with or without a file extension
            // in its URL — must not bounce the user out of a page
            // that is loading or has loaded fine. The fatal case is
            // judged only while a load is IN FLIGHT (no document has
            // completed for this navigation): the failing URL must
            // equal the URL the current load started with, which
            // onLoadStart records from its own event. Once a document
            // HAS loaded, no http error is fatal — a same-URL XHR
            // the page makes to its own endpoint is indistinguishable
            // from a document load by URL alone, and the page handles
            // those responses itself.
            const errorUrl =
              (syntheticEvent &&
                syntheticEvent.nativeEvent &&
                syntheticEvent.nativeEvent.url) ||
              '';
            if (
              !loadedUrlRef.current &&
              errorUrl &&
              errorUrl === currentUrlRef.current
            ) {
              setLoadError(true);
              return;
            }
            log.info('Ignoring subresource http error');
          }}
          onShouldStartLoadWithRequest={request => {
            if (request.url.startsWith('ms-xal-000000004c20a908:')) {
              handleRedirect(request.url);
              return false;
            }
            return true;
          }}
          onNavigationStateChange={navState => {
            const {url} = navState;
            currentUrlRef.current = url;
            if (url.startsWith('ms-xal-000000004c20a908:')) {
              handleRedirect(url);
            }
          }}
        />
        {pageLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#107C10" />
            <Text style={styles.loadingText}>{t('Loading...')}</Text>
          </View>
        )}
      </View>
    );
  }

  if (!paramsChecked) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#107C10" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="titleMedium" style={styles.text}>
        {t('No login link available. Please go back and try again.')}
      </Text>
      <Button mode="contained" onPress={() => navigation.goBack()}>
        {t('Back')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  webviewWrap: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#107C10',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    textAlign: 'center',
    marginBottom: 20,
  },
  secondButton: {
    marginTop: 12,
  },
});

export default LoginScreen;
