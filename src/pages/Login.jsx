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

  React.useEffect(() => {
    setParamsChecked(true);
    if (route.params?.authUrl) {
      // Do not write the full auth URL (it carries auth parameters) to logs.
      log.info('Receive authUrl');
      redirectHandled.current = false;
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
          onLoadStart={() => setPageLoading(true)}
          onLoadEnd={() => setPageLoading(false)}
          onError={() => setLoadError(true)}
          onHttpError={syntheticEvent => {
            // Only a failure of the login page ITSELF is fatal: on
            // Android this callback also fires for subresource
            // requests, and one 404 asset (script/style/image/font)
            // must not bounce the user out of a page that loaded
            // fine. Document failures still land on the error
            // screen.
            const errorUrl =
              (syntheticEvent &&
                syntheticEvent.nativeEvent &&
                syntheticEvent.nativeEvent.url) ||
              '';
            if (
              /\.(js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|map)(\?|#|$)/i.test(
                errorUrl,
              )
            ) {
              return;
            }
            setLoadError(true);
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
