import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text, Button} from 'react-native-paper';
import {WebView} from 'react-native-webview';
import {useTranslation} from 'react-i18next';
import {debugFactory} from '../utils/debug';

const log = debugFactory('LoginScreen');

function DetailScreen({navigation, route}) {
  const {t} = useTranslation();
  const [authUrl, setAuthUrl] = React.useState('');
  const [loadError, setLoadError] = React.useState(false);
  const redirectHandled = React.useRef(false);

  React.useEffect(() => {
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
        <Button mode="contained" onPress={() => navigation.goBack()}>
          {t('Back')}
        </Button>
      </View>
    );
  }

  if (authUrl !== '') {
    return (
      <WebView
        source={{uri: authUrl}}
        originWhitelist={['*']}
        setSupportMultipleWindows={false}
        onError={() => setLoadError(true)}
        onHttpError={() => setLoadError(true)}
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
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default DetailScreen;
