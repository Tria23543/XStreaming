import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';

type Props = {
  style: any;
  scale?: number;
  size?: number;
  onPressIn: any;
  onPressOut: any;
};

const Dpad: React.FC<Props> = ({
  style = {},
  scale = 1,
  size = 100,
  onPressIn,
  onPressOut,
}) => {
  const handlePressIn = (name: string) => {
    onPressIn && onPressIn(name);
  };

  const handlePressOut = (name: string) => {
    onPressOut && onPressOut(name);
  };

  return (
    <View
      style={[
        styles.dpad,
        {width: size, height: size, transform: [{scale}]},
        style,
      ]}>
      <TouchableOpacity
        style={[styles.button, styles.dpadLeft]}
        onPressIn={() => {
          handlePressIn('DPadLeft');
        }}
        onPressOut={() => {
          handlePressOut('DPadLeft');
        }}
      />
      <TouchableOpacity
        style={[styles.button, styles.dpadTop]}
        onPressIn={() => {
          handlePressIn('DPadUp');
        }}
        onPressOut={() => {
          handlePressOut('DPadUp');
        }}
      />
      <TouchableOpacity
        style={[styles.button, styles.dpadRight]}
        onPressIn={() => {
          handlePressIn('DPadRight');
        }}
        onPressOut={() => {
          handlePressOut('DPadRight');
        }}
      />
      <TouchableOpacity
        style={[styles.button, styles.dpadBottom]}
        onPressIn={() => {
          handlePressIn('DPadDown');
        }}
        onPressOut={() => {
          handlePressOut('DPadDown');
        }}
      />
    </View>
  );
};

// Segment geometry is percentage-based so the cross fills whatever size
// the layout assigns (layouts define the D-pad as 100x100 by default):
// arms are 37.5% long and 25% thick, starting at 37.5%/62.5% offsets.
// Every part of the cross stays inside the container, visible and
// tappable exactly where it is drawn.
const styles = StyleSheet.create({
  dpad: {
    position: 'absolute',
  },
  button: {
    position: 'absolute',
  },
  dpadLeft: {
    width: '37.5%',
    height: '25%',
    borderWidth: 2,
    borderColor: '#fff',
    left: 0,
    top: '37.5%',
    borderRightWidth: 0,
  },
  dpadTop: {
    width: '25%',
    height: '37.5%',
    borderWidth: 2,
    borderColor: '#fff',
    left: '37.5%',
    top: 0,
    borderBottomWidth: 0,
  },
  dpadRight: {
    width: '37.5%',
    height: '25%',
    borderWidth: 2,
    borderColor: '#fff',
    left: '62.5%',
    top: '37.5%',
    borderLeftWidth: 0,
  },
  dpadBottom: {
    width: '25%',
    height: '37.5%',
    borderWidth: 2,
    borderColor: '#fff',
    left: '37.5%',
    top: '62.5%',
    borderTopWidth: 0,
  },
});

export default Dpad;
