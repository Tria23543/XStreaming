import React from 'react';
import {StyleSheet, ScrollView, Alert, View} from 'react-native';
import {Text} from 'react-native-paper';
import Spinner from 'react-native-loading-spinner-overlay';
import SettingItem from '../components/SettingItem';
import {useSelector} from 'react-redux';
import RNRestart from 'react-native-restart';
import CookieManager from '@react-native-cookies/cookies';
import {useTranslation} from 'react-i18next';
import {clearCatalogCache} from '../store/catalogCache';
import {debugFactory} from '../utils/debug';

import bases from '../common/settings/bases';
import display from '../common/settings/display';
import gamepad from '../common/settings/gamepad';
import audio from '../common/settings/audio';
import xcloud from '../common/settings/xcloud';
import xhome from '../common/settings/xhome';

import pkg from '../../package.json';

const log = debugFactory('SettingsScreen');

function SettingsScreen({navigation}) {
  const {t} = useTranslation();
  const authentication = useSelector(state => state.authentication);
  const profile = useSelector(state => state.profile);

  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    log.info('settings page show');
  }, [navigation]);

  const handleItemPress = async id => {
    if (id === 'logout') {
      Alert.alert(t('Warning'), t('Do you want to logout?'), [
        {
          text: t('Cancel'),
          style: 'cancel',
        },
        {
          text: t('Confirm'),
          style: 'default',
          onPress: () => {
            setLoading(true);
            authentication?._tokenStore?.clear();
            // The catalog cache carries this account's entitlement
            // flags; a different account signing in next must not
            // inherit them.
            clearCatalogCache();
            CookieManager.clearAll().catch(() => {});
            setTimeout(() => {
              RNRestart.restart();
            }, 1000);
          },
        },
      ]);
    } else {
      navigation.navigate('SettingDetail', {
        id,
      });
    }
  };

  return (
    <View style={styles.container}>
      <Spinner
        visible={loading}
        textContent={t('Loading...')}
        color={'#107C10'}
        textStyle={styles.spinnerTextStyle}
      />

      <ScrollView>
        <View>
          <View style={styles.contentTitle}>
            <Text variant="titleLarge" style={styles.titleText}>
              {t('BasesSettings')}
            </Text>
          </View>

          {bases.map((meta, idx) => {
            return (
              <SettingItem
                key={meta.name || idx}
                title={meta.title}
                description={meta.description}
                onPress={() => handleItemPress(meta.name)}
              />
            );
          })}
        </View>

        <View>
          <View style={styles.contentTitle}>
            <Text variant="titleLarge" style={styles.titleText}>
              {t('DisplaySettings')}
            </Text>
          </View>

          {display.map((meta, idx) => {
            return (
              <SettingItem
                key={meta.name || idx}
                title={meta.title}
                description={meta.description}
                onPress={() => handleItemPress(meta.name)}
              />
            );
          })}

          <SettingItem
            title={t('Picture settings')}
            description={t(
              'Adjust sharpness, saturation, contrast and brightness',
            )}
            onPress={() => {
              navigation.navigate('Display');
            }}
          />
        </View>

        <View>
          <View style={styles.contentTitle}>
            <Text variant="titleLarge" style={styles.titleText}>
              {t('GamepadSettings')}
            </Text>
          </View>

          {gamepad.map((meta, idx) => {
            return (
              <SettingItem
                key={meta.name || idx}
                title={meta.title}
                description={meta.description}
                onPress={() => handleItemPress(meta.name)}
              />
            );
          })}

          <SettingItem
            title={t('Customize virtual buttons')}
            description={t('Customize buttons of virtual gamepad')}
            onPress={() => {
              navigation.navigate('VirtualGamepadSettings');
            }}
          />
        </View>

        <View>
          <View style={styles.contentTitle}>
            <Text variant="titleLarge" style={styles.titleText}>
              {t('AudioSettings')}
            </Text>
          </View>

          {audio.map((meta, idx) => {
            return (
              <SettingItem
                key={meta.name || idx}
                title={meta.title}
                description={meta.description}
                onPress={() => handleItemPress(meta.name)}
              />
            );
          })}
        </View>

        <View>
          <View style={styles.contentTitle}>
            <Text variant="titleLarge" style={styles.titleText}>
              {t('XcloudSettings')}
            </Text>
          </View>

          {xcloud.map((meta, idx) => {
            return (
              <SettingItem
                key={meta.name || idx}
                title={meta.title}
                description={meta.description}
                onPress={() => handleItemPress(meta.name)}
              />
            );
          })}
        </View>

        <View>
          <View style={styles.contentTitle}>
            <Text variant="titleLarge" style={styles.titleText}>
              {t('XchomeSettings')}
            </Text>
          </View>

          {xhome.map((meta, idx) => {
            return (
              <SettingItem
                key={meta.name || idx}
                title={meta.title}
                description={meta.description}
                onPress={() => handleItemPress(meta.name)}
              />
            );
          })}
        </View>

        <View>
          <View style={styles.contentTitle}>
            <Text variant="titleLarge" style={styles.titleText}>
              {t('Others')}
            </Text>
          </View>

          <SettingItem
            title={t('About')}
            description={`${t('About XStreaming')}\nv${pkg.version}`}
            onPress={() => navigation.navigate('About')}
          />

          <SettingItem
            title={t('Feedback')}
            description={t('Community and support the author')}
            onPress={() => navigation.navigate('Feedback')}
          />

          {profile && profile.GameDisplayName ? (
            <SettingItem
              title={t('Logout')}
              description={`${t('Current user')}: ${
                profile ? profile.GameDisplayName : ''
              }`}
              onPress={() => handleItemPress('logout')}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  spinnerTextStyle: {
    color: '#FFF',
  },
  contentTitle: {
    padding: 15,
    paddingBottom: 0,
  },
  titleText: {
    color: '#107C10',
  },
});

export default SettingsScreen;
