import React from 'react';
import {getDefaultButtons} from '../common/gamepadDefaults';
import {StyleSheet, View, Dimensions} from 'react-native';
import GamepadButton from './CustomGamepad/GamepadButton';
import Dpad from './CustomGamepad/Dpad';
import {ReactNativeJoystick} from '../components/Joystick';
import {getSettings} from '../store/gamepadStore';

type Props = {
  title: string;
  opacity: number;
  onPressIn: (name: string) => {};
  onPressOut: (name: string) => {};
  onStickMove: (id: string, position: any) => {};
};

const CustomVirtualGamepad: React.FC<Props> = ({
  title,
  opacity = 0.6,
  onPressIn,
  onPressOut,
  onStickMove,
}) => {
  const [buttons, setButtons] = React.useState<any>([]);

  React.useEffect(() => {
    const _settings = getSettings();
    const {width, height} = Dimensions.get('window');

    const _buttons = getDefaultButtons(width, height);
    if (
      _settings[title] &&
      Array.isArray(_settings[title]) &&
      _settings[title].length > 0
    ) {
      setButtons(_settings[title]);
    } else {
      // No saved layout (or an empty/corrupt one): fall back to defaults
      // instead of rendering no gamepad at all.
      setButtons(_buttons);
    }
  }, [title]);

  const handlePressIn = (name: string) => {
    onPressIn && onPressIn(name);
  };

  const handlePressOut = (name: string) => {
    onPressOut && onPressOut(name);
  };

  const handleStickMove = (id: string, data: any) => {
    onStickMove && onStickMove(id, data);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {buttons.map((button: any) => {
        if (button.show === false) {
          return null;
        }
        if (button.name === 'Dpad') {
          return (
            <Dpad
              key={button.name}
              scale={button.scale}
              size={button.width || 100}
              style={{
                opacity: opacity,
                left: button.x,
                top: button.y,
              }}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            />
          );
        } else if (button.name === 'LeftStick') {
          return (
            <View
              key={button.name}
              style={[
                styles.button,
                {top: button.y, left: button.x},
                {opacity},
              ]}>
              <ReactNativeJoystick
                color="#ffffff"
                radius={50}
                onMove={data => handleStickMove('left', data)}
                onStart={data => handleStickMove('left', data)}
                onStop={data => handleStickMove('left', data)}
              />
            </View>
          );
        } else if (button.name === 'RightStick') {
          return (
            <View
              key={button.name}
              style={[
                styles.button,
                {top: button.y, left: button.x},
                {opacity},
              ]}>
              <ReactNativeJoystick
                color="#ffffff"
                radius={50}
                onMove={data => handleStickMove('right', data)}
                onStart={data => handleStickMove('right', data)}
                onStop={data => handleStickMove('right', data)}
              />
            </View>
          );
        } else {
          return (
            <GamepadButton
              key={button.name}
              name={button.name}
              scale={button.scale}
              style={[
                styles.button,
                {opacity},
                {top: button.y, left: button.x},
              ]}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            />
          );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    // backgroundColor: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 9,
  },
  button: {
    opacity: 0.5,
    position: 'absolute',
  },
});

export default CustomVirtualGamepad;
