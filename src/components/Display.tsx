import React from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {Text, Button, IconButton} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import {useTranslation} from 'react-i18next';

type Props = {
  options: any;
  onChange: (value: any) => {};
};
const defaultValue = {
  sharpness: 5,
  saturation: 100,
  contrast: 100,
  brightness: 100,
};

const Display: React.FC<Props> = ({options, onChange}) => {
  const {t} = useTranslation();
  const [innerOptions, setInnerOptions] = React.useState<any>(defaultValue);

  React.useEffect(() => {
    // Merge over the defaults so a missing/partial options object never
    // leaves the sliders blank.
    const merged = {...defaultValue};
    if (options) {
      Object.keys(defaultValue).forEach(key => {
        const v = (options as any)[key];
        if (typeof v === 'number' && !isNaN(v)) {
          (merged as any)[key] = v;
        }
      });
    }
    setInnerOptions(merged);
  }, [options]);

  // Always build a new object: mutating state in place and passing the
  // same reference to onChange lets callers persist a stale snapshot.
  const handleValChange = (key: string, value: string | number) => {
    const next = {...innerOptions, [key]: value};
    setInnerOptions(next);
    onChange && onChange(next);
  };

  const step = (key: string, delta: number, min: number, max: number) => {
    const current = innerOptions[key];
    const next = current + delta;
    if (next >= min && next <= max) {
      handleValChange(key, next);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <View style={styles.title}>
          <View style={styles.titleLeft}>
            <Text variant="titleMedium">{t('Sharpness')}</Text>
          </View>
          <View style={styles.titleRight}>
            <IconButton
              icon="minus"
              size={20}
              onPress={() => step('sharpness', -1, 0, 10)}
            />
            <Text variant="titleMedium">
              {innerOptions.sharpness === 0
                ? t('Off')
                : innerOptions.sharpness}
            </Text>
            <IconButton
              icon="plus"
              size={20}
              onPress={() => step('sharpness', 1, 0, 10)}
            />
          </View>
        </View>
        <Slider
          style={styles.slider}
          value={innerOptions.sharpness}
          minimumValue={0}
          maximumValue={10}
          step={1}
          onValueChange={val => {
            handleValChange('sharpness', val);
          }}
          lowerLimit={0}
          minimumTrackTintColor="#107C10"
          maximumTrackTintColor="grey"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <View style={styles.titleLeft}>
            <Text variant="titleMedium">{t('Saturation')}</Text>
          </View>
          <View style={styles.titleRight}>
            <IconButton
              icon="minus"
              size={20}
              onPress={() => step('saturation', -10, 50, 150)}
            />
            <Text variant="titleMedium">{innerOptions.saturation}%</Text>
            <IconButton
              icon="plus"
              size={20}
              onPress={() => step('saturation', 10, 50, 150)}
            />
          </View>
        </View>
        <Slider
          style={styles.slider}
          value={innerOptions.saturation}
          minimumValue={50}
          maximumValue={150}
          step={10}
          onValueChange={val => {
            handleValChange('saturation', val);
          }}
          lowerLimit={0}
          minimumTrackTintColor="#107C10"
          maximumTrackTintColor="grey"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <View style={styles.titleLeft}>
            <Text variant="titleMedium">{t('Contrast')}</Text>
          </View>
          <View style={styles.titleRight}>
            <IconButton
              icon="minus"
              size={20}
              onPress={() => step('contrast', -10, 50, 150)}
            />
            <Text variant="titleMedium">{innerOptions.contrast}%</Text>
            <IconButton
              icon="plus"
              size={20}
              onPress={() => step('contrast', 10, 50, 150)}
            />
          </View>
        </View>
        <Slider
          style={styles.slider}
          value={innerOptions.contrast}
          minimumValue={50}
          maximumValue={150}
          step={10}
          onValueChange={val => {
            handleValChange('contrast', val);
          }}
          lowerLimit={0}
          minimumTrackTintColor="#107C10"
          maximumTrackTintColor="grey"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <View style={styles.titleLeft}>
            <Text variant="titleMedium">{t('Brightness')}</Text>
          </View>
          <View style={styles.titleRight}>
            <IconButton
              icon="minus"
              size={20}
              onPress={() => step('brightness', -10, 50, 150)}
            />
            <Text variant="titleMedium">{innerOptions.brightness}%</Text>
            <IconButton
              icon="plus"
              size={20}
              onPress={() => step('brightness', 10, 50, 150)}
            />
          </View>
        </View>
        <Slider
          style={styles.slider}
          value={innerOptions.brightness}
          minimumValue={50}
          maximumValue={150}
          step={10}
          onValueChange={val => {
            handleValChange('brightness', val);
          }}
          lowerLimit={0}
          minimumTrackTintColor="#107C10"
          maximumTrackTintColor="grey"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  block: {
    marginBottom: 10,
  },
  title: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleLeft: {},
  titleRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    marginTop: 10,
  },
});

export default Display;
