import React from 'react';
import {StyleSheet, View, ScrollView, Image} from 'react-native';
import {Text} from 'react-native-paper';
import LinkText from '../components/LinkText';
import {useTranslation} from 'react-i18next';

function FeedbackScreen({navigation, route}) {
  const {t} = useTranslation();
  return (
    <ScrollView style={styles.container}>
      <View style={styles.block}>
        <View style={styles.title}>
          <Text variant="titleLarge">{t('Community')}</Text>
        </View>
        <View>
          <Text variant="titleMedium">
            {t(
              "Interested in console streaming, cloud gaming and streaming technology? You are welcome to join the author's QQ group chat.",
            )}
          </Text>
          <Text variant="titleMedium">{t('QQ group: 964721224')}</Text>
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <Text variant="titleLarge">{t('Support the author')}</Text>
        </View>

        <View>
          <Text variant="titleMedium">
            {t('You can also support XStreaming through GitHub Sponsors:')}
          </Text>
          <LinkText url={'https://github.com/sponsors/Geocld'}>
            https://github.com/sponsors/Geocld
          </LinkText>
        </View>

        <View style={{paddingBottom: 50, paddingTop: 20}}>
          <Image
            source={require('../assets/feedback/wx_sponsor.png')}
            style={{width: '100%', height: 400}}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  block: {
    marginBottom: 20,
  },
  title: {
    marginBottom: 10,
  },
});

export default FeedbackScreen;
