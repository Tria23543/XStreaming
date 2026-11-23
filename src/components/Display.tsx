import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, IconButton} from 'react-native-paper';
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
    // leaves the sliders blank. Values are clamped into each slider's
    // range: an out-of-range stored value (corrupt/legacy options)
    // could never be stepped back into range, because step() rejects
    // any result outside [min, max].
    const RANGES: any = {
      sharpness: [0, 10],
      saturation: [50, 150],
      contrast: [50, 150],
      brightness: [50, 150],
    };
    // Start from the stored object itself so keys this component
    // does not know about survive a save instead of being silently
    // dropped; the four known keys are then overwritten with their
    // clamped (or default) values.
    const merged: any = {...defaultValue, ...(options || {})};
    Object.keys(defaultValue).forEach(key => {
      const v = options ? (options as any)[key] : undefined;
      if (typeof v === 'number' && !isNaN(v)) {
        const range = RANGES[key];
        merged[key] = range ? Math.min(range[1], Math.max(range[0], v)) : v;
      } else {
        merged[key] = (defaultValue as any)[key];
      }
    });
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
    let next = current + delta;
    // An off-grid value must be able to land ON the boundary:
    // stepping down from 55 toward a minimum of 50 gives 45, which
    // the old in-range check rejected — trapping the value above
    // the minimum forever.
    if (next < min) {
      next = current > min ? min : current;
    } else if (next > max) {
      next = current < max ? max : current;
    }
    if (next !== current) {
      handleValChange(key, next);
    }
  };

  return (
    <View>
      <View style={styles.block}>
        <View style={styles.title}>
          <View>
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
          <View>
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
          lowerLimit={50}
          minimumTrackTintColor="#107C10"
          maximumTrackTintColor="grey"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <View>
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
          lowerLimit={50}
          minimumTrackTintColor="#107C10"
          maximumTrackTintColor="grey"
        />
      </View>

      <View style={styles.block}>
        <View style={styles.title}>
          <View>
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
          lowerLimit={50}
          minimumTrackTintColor="#107C10"
          maximumTrackTintColor="grey"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    marginBottom: 10,
  },
  title: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    marginTop: 10,
  },
});

export default Display;
