import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, Button} from 'react-native-paper';
import {useTranslation} from 'react-i18next';
import {SvgXml} from 'react-native-svg';
import icons from '../common/svg';
import {getSettings} from '../store/settingStore';

const ConsoleItem = (props: any) => {
  const {t} = useTranslation();
  const settings = getSettings();

  const consoleItem = props.consoleItem;

  return (
    <Card>
      <Card.Content>
        <View>
          <Text variant="titleLarge" style={styles.textCenter}>
            {consoleItem.name}
          </Text>
          <View style={styles.image}>
            <SvgXml xml={icons.ConsoleIcon} width={'100%'} height={80} />
          </View>
          <View>
            <Text variant="titleMedium" style={styles.textCenter}>
              {consoleItem.consoleType}
            </Text>
            {consoleItem.powerState === 'On' ? (
              <Text style={[styles.green, styles.textCenter]}>
                {t('Powered on')}
              </Text>
            ) : consoleItem.powerState === 'ConnectedStandby' ? (
              <Text style={[styles.yellow, styles.textCenter]}>
                {t('Standby')}
              </Text>
            ) : consoleItem.powerState === 'Off' ? (
              <Text style={[styles.red, styles.textCenter]}>
                {t('Off')}
              </Text>
            ) : (
              <Text style={[styles.textCenter]}>{t('Unknown')}</Text>
            )}
          </View>
        </View>
        <View style={styles.footer}>
          {settings.power_on &&
          (consoleItem.powerState === 'ConnectedStandby' ||
            consoleItem.powerState === 'Off') ? (
            <Button
              mode="outlined"
              labelStyle={{marginHorizontal: 0}}
              background={{
                borderless: false,
                color: 'rgba(255, 255, 255, 0.2)',
                foreground: true,
              }}
              onPress={props.onPoweronStream}>
              {t('Power on and start stream')}
            </Button>
          ) : (
            <Button
              mode="outlined"
              labelStyle={{marginHorizontal: 0}}
              background={{
                borderless: false,
                color: 'rgba(255, 255, 255, 0.2)',
                foreground: true,
              }}
              onPress={props.onPress}>
              {t('Start stream')}
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  green: {
    color: '#36B728',
  },
  yellow: {
    color: '#D1BE02',
  },
  red: {
    color: '#dc2626',
  },
  image: {
    paddingTop: 5,
    paddingBottom: 5,
  },
  textCenter: {
    textAlign: 'center',
    marginBottom: 5,
  },
  footer: {
    paddingTop: 10,
  },
});

export default ConsoleItem;
