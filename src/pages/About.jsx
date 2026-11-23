import React from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {Text} from 'react-native-paper';
import LinkText from '../components/LinkText';
import {useTranslation} from 'react-i18next';

function AboutScreen() {
  const {t} = useTranslation();
  return (
    <ScrollView style={styles.container}>
      <View style={styles.block}>
        <View style={styles.title}>
          <Text variant="titleLarge">XStreaming</Text>
        </View>
        <View>
          <Text variant="titleMedium">
            {t(
              'XStreaming is a fully open-source mobile client for xCloud and Xbox home streaming, greatly inspired by',
            )}{' '}
            <LinkText url={'https://github.com/unknownskl/greenlight'}>
              Greenlight
            </LinkText>
          </Text>
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <Text variant="titleLarge">
            {t('Want to contribute to XStreaming?')}
          </Text>
        </View>

        <View>
          <Text variant="titleMedium">XStreaming:</Text>
        </View>
        <View>
          <LinkText url={'https://github.com/Geocld/XStreaming'}>
            https://github.com/Geocld/XStreaming
          </LinkText>
        </View>

        <View>
          <Text variant="titleMedium">
            {t('XStreaming-desktop (Windows/macOS/SteamOS):')}
          </Text>
        </View>
        <View>
          <LinkText url={'https://github.com/Geocld/XStreaming-desktop'}>
            https://github.com/Geocld/XStreaming-desktop
          </LinkText>
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <Text variant="titleLarge">
            {t('Are you looking for a PlayStation streaming client?')}
          </Text>
        </View>

        <View>
          <Text variant="titleMedium">PeaSyo:</Text>
        </View>
        <View>
          <LinkText url={'https://github.com/Geocld/PeaSyo'}>
            https://github.com/Geocld/PeaSyo
          </LinkText>
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <Text variant="titleLarge">{t('About the author')}</Text>
        </View>
        <View>
          <View>
            <Text variant="titleMedium">Geocld:</Text>
          </View>
          <View>
            <LinkText url={'https://github.com/Geocld'}>
              https://github.com/Geocld
            </LinkText>
          </View>
        </View>
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <Text variant="titleLarge">
            {t('Support XStreaming to Make the Project Better!')}
          </Text>
        </View>

        <View>
          <Text variant="titleMedium">
            {t(
              'You can contribute through GitHub Sponsors or via the XStreaming online donation platform.',
            )}
          </Text>
        </View>
        <View>
          <LinkText url={'https://github.com/sponsors/Geocld'}>
            https://github.com/sponsors/Geocld
          </LinkText>
        </View>

        <View>
          <LinkText url={'https://xstreaming-website.pages.dev/'}>
            https://xstreaming-website.pages.dev
          </LinkText>
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

export default AboutScreen;
