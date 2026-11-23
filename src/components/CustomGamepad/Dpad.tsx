import React from 'react';
import {View, TouchableOpacity, StyleSheet} from 'react-native';

type Props = {
  style: any;
  scale?: number;
  onPressIn: any;
  onPressOut: any;
};

const GamepadButton: React.FC<Props> = ({
  style = {},
  scale = 1,
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
    <View style={[styles.dpad, {transform: [{scale}]}, style]}>
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

// All four segments live inside the 120x120 container, so every part of
// the cross is visible and tappable exactly where it is drawn.
const styles = StyleSheet.create({
  dpad: {
    position: 'absolute',
    width: 120,
    height: 120,
  },
  button: {
    position: 'absolute',
  },
  dpadLeft: {
    width: 45,
    height: 30,
    borderWidth: 2,
    borderColor: '#fff',
    left: 0,
    top: 45,
    borderRightWidth: 0,
  },
  dpadTop: {
    width: 30,
    height: 45,
    borderWidth: 2,
    borderColor: '#fff',
    left: 45,
    top: 0,
    borderBottomWidth: 0,
  },
  dpadRight: {
    width: 45,
    height: 30,
    borderWidth: 2,
    borderColor: '#fff',
    left: 75,
    top: 45,
    borderLeftWidth: 0,
  },
  dpadBottom: {
    width: 30,
    height: 45,
    borderWidth: 2,
    borderColor: '#fff',
    left: 45,
    top: 75,
    borderTopWidth: 0,
  },
});

export default GamepadButton;
