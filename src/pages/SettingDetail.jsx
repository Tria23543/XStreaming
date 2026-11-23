import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Platform,
  ToastAndroid,
} from 'react-native';
import {Button, RadioButton, Text, Divider, Snackbar} from 'react-native-paper';
import {useTranslation} from 'react-i18next';
import RNRestart from 'react-native-restart';
import Slider from '@react-native-community/slider';
import {useSelector} from 'react-redux';
import {getSettings, saveSettings} from '../store/settingStore';

import bases from '../common/settings/bases';
import display from '../common/settings/display';
import gamepad from '../common/settings/gamepad';
import audio from '../common/settings/audio';
import xcloud from '../common/settings/xcloud';
import xhome from '../common/settings/xhome';

function SettingDetailScreen({navigation, route}) {
  const {t} = useTranslation();

  const [current, setCurrent] = React.useState('');
  const [value, setValue] = React.useState('');
  const [value2, setValue2] = React.useState('');
  const [currentMetas, setCurrentMetas] = React.useState(null);
  const [settings, setSettings] = React.useState({});
  const [savedVisible, setSavedVisible] = React.useState(false);
  const saveTimer = React.useRef(null);
  React.useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const regions = React.useRef([]);
  const xgpuRegions = React.useRef([]);

  const streamingTokens = useSelector(state => state.streamingTokens);
  regions.current = streamingTokens.xHomeToken?.getRegions() || [];

  if (streamingTokens.xCloudToken) {
    xgpuRegions.current = streamingTokens.xCloudToken?.getRegions() || [];
  }

  React.useEffect(() => {
    const _settings = getSettings();
    // Do not log the full settings object.
    setSettings(_settings);

    if (route.params?.id) {
      const name = route.params.id;
      let currentVal = _settings[name];
      const settingsMeta = [
        ...bases,
        ...display,
        ...gamepad,
        ...audio,
        ...xcloud,
        ...xhome,
      ];
      let metas = {};
      settingsMeta.forEach(item => {
        if (item.name === name) {
          metas = item;
        }
      });

      if (name === 'xhome_bitrate_mode') {
        setValue2(_settings.xhome_bitrate);
      }
      if (name === 'xcloud_bitrate_mode') {
        setValue2(_settings.xcloud_bitrate);
      }
      if (name === 'audio_bitrate_mode') {
        setValue2(_settings.audio_bitrate);
      }

      if (name === 'signaling_home' || name === 'signaling_cloud') {
        const rs =
          name === 'signaling_home' ? regions.current : xgpuRegions.current;
        const savedVal = _settings[name];
        if (savedVal && rs.some(region => region.name === savedVal)) {
          // The user's saved choice wins over the token's current default.
          currentVal = savedVal;
        } else {
          rs.forEach(region => {
            if (region.isDefault) {
              currentVal = region.name;
            }
          });
        }
      }

      setValue(currentVal);
      setCurrent(name);
      setCurrentMetas(metas);
      navigation.setOptions({
        title: metas.title || '',
      });
    }
  }, [navigation, route.params?.id]);

  const handleSaveSettings = () => {
    // Never overwrite a saved signal-server choice with an empty value
    // (can happen if the page mounted before the tokens existed and no
    // region ended up selected).
    if (
      (current === 'signaling_home' || current === 'signaling_cloud') &&
      !value &&
      settings[current]
    ) {
      return;
    }
    if (settings[current] !== undefined) {
      settings[current] = value;
      setSettings(settings);
      saveSettings(settings);
    }
  };

  const handleSave = () => {
    if (current === 'locale' || current === 'force_region_ip') {
      // These take effect through a restart; save once and stop here so
      // the save/navigation below does not also run.
      handleSaveSettings();
      restart();
      return;
    }
    if (current === 'xhome_bitrate_mode') {
      settings.xhome_bitrate_mode = value;
      settings.xhome_bitrate = value2;
    } else if (current === 'xcloud_bitrate_mode') {
      settings.xcloud_bitrate_mode = value;
      settings.xcloud_bitrate = value2;
    } else if (current === 'audio_bitrate_mode') {
      settings.audio_bitrate_mode = value;
      settings.audio_bitrate = value2;
    } else if (currentMetas.name === 'signaling_home') {
      // Persist the choice in settings (handleSaveSettings below) and
      // apply it to the live token so it takes effect immediately.
      if (value) {
        streamingTokens.xHomeToken &&
          streamingTokens.xHomeToken.setDefaultRegion(value);
      }
    } else if (currentMetas.name === 'signaling_cloud') {
      if (value) {
        streamingTokens.xCloudToken &&
          streamingTokens.xCloudToken.setDefaultRegion(value);
      }
    }
    handleSaveSettings();
    if (Platform.OS === 'android') {
      ToastAndroid.show(t('Saved'), ToastAndroid.SHORT);
      navigation.goBack();
    } else {
      // iOS has no ToastAndroid; show a brief confirmation, then go back.
      // The timer is tracked so leaving the page first (or saving twice)
      // cannot pop an extra screen afterwards.
      setSavedVisible(true);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      saveTimer.current = setTimeout(() => {
        navigation.goBack();
      }, 700);
    }
  };

  const restart = () => {
    setTimeout(() => {
      RNRestart.restart();
    }, 500);
  };

  const renderOptions = () => {
    if (!currentMetas) {
      return null;
    }
    if (
      currentMetas.name === 'xhome_bitrate_mode' ||
      currentMetas.name === 'xcloud_bitrate_mode' ||
      currentMetas.name === 'audio_bitrate_mode'
    ) {
      return (
        <>
          <RadioButton.Group onValueChange={val => setValue(val)} value={value}>
            {currentMetas &&
              currentMetas.data.map((item, idx) => {
                return (
                  <RadioButton.Item
                    key={idx}
                    label={item.text}
                    value={item.value}
                  />
                );
              })}
          </RadioButton.Group>
          {value === 'custom' && (
            <>
              <Text style={styles.sliderTitle}>
                {t('Current')}: {value2} Mbps
              </Text>
              <Slider
                style={styles.slider}
                value={value2}
                minimumValue={1}
                maximumValue={50}
                step={1}
                lowerLimit={1}
                onValueChange={val => {
                  setValue2(val);
                }}
                minimumTrackTintColor="#107C10"
                maximumTrackTintColor="grey"
              />
            </>
          )}
        </>
      );
    }
    if (
      currentMetas.name === 'signaling_home' ||
      currentMetas.name === 'signaling_cloud'
    ) {
      const servers =
        currentMetas.name === 'signaling_home'
          ? regions.current
          : xgpuRegions.current;
      if (!servers || servers.length === 0) {
        return (
          <View style={styles.tips}>
            <Text>
              {t(
                'No servers available yet. Please log in first, then reopen this page.',
              )}
            </Text>
          </View>
        );
      }
      return (
        <RadioButton.Group onValueChange={val => setValue(val)} value={value}>
          {servers.map((item, idx) => {
            return (
              <RadioButton.Item key={idx} label={item.name} value={item.name} />
            );
          })}
        </RadioButton.Group>
      );
    }
    if (currentMetas.type === 'radio') {
      return (
        <RadioButton.Group onValueChange={val => setValue(val)} value={value}>
          {currentMetas &&
            currentMetas.data.map((item, idx) => {
              return (
                <RadioButton.Item
                  key={idx}
                  label={item.text}
                  value={item.value}
                />
              );
            })}
        </RadioButton.Group>
      );
    } else if (currentMetas.type === 'slider') {
      return (
        <>
          <Text style={styles.sliderTitle}>
            {t('Current')}: {value}
          </Text>
          <Slider
            style={styles.slider}
            value={value}
            minimumValue={currentMetas.min}
            maximumValue={currentMetas.max}
            step={currentMetas.step}
            onValueChange={val => {
              setValue(parseFloat(val.toFixed(2)));
            }}
            lowerLimit={currentMetas.min}
            minimumTrackTintColor="#107C10"
            maximumTrackTintColor="grey"
          />
        </>
      );
    } else {
      return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.tips}>
          <Text>{currentMetas && currentMetas.description}</Text>
        </View>

        {currentMetas && currentMetas.tips && (
          <View style={styles.tips}>
            <Text>Tips: {currentMetas && currentMetas.tips}</Text>
          </View>
        )}

        <Divider />

        {renderOptions()}
      </ScrollView>

      <View style={styles.buttonWrap}>
        <Button mode="contained" style={styles.button} onPress={handleSave}>
          {t('Save')}
        </Button>
        <Button
          mode="outlined"
          style={styles.button}
          onPress={() => navigation.goBack()}>
          {t('Back')}
        </Button>
      </View>

      <Snackbar
        visible={savedVisible}
        onDismiss={() => setSavedVisible(false)}
        duration={700}>
        {t('Saved')}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tips: {
    padding: 10,
  },
  scrollView: {
    marginBottom: 120,
  },
  sliderTitle: {
    padding: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  buttonWrap: {
    position: 'absolute',
    left: 0,
    width: '100%',
    bottom: 20,
    paddingLeft: 10,
    paddingRight: 10,
  },
  button: {
    marginTop: 10,
  },
});

export default SettingDetailScreen;
