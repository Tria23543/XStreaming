import React, {useState, useCallback, useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import * as utils from './utils';
import {
  Gesture,
  GestureDetector,
  GestureTouchEvent,
} from 'react-native-gesture-handler';
import {IReactNativeJoystickProps} from './types';

export const ReactNativeJoystick = ({
  onStart,
  onMove,
  onStop,
  color = '#000000',
  radius = 150,
  style,
  ...props
}: IReactNativeJoystickProps) => {
  const wrapperRadius = radius;
  const nippleRadius = wrapperRadius / 2;

  const [x, setX] = useState(wrapperRadius - nippleRadius);
  const [y, setY] = useState(wrapperRadius - nippleRadius);

  const handleTouchMove = useCallback(
    (event: GestureTouchEvent) => {
      const e = event.changedTouches[0];
      const fingerX = e.x;
      const fingerY = e.y;
      let coordinates = {
        x: fingerX - nippleRadius,
        y: fingerY - nippleRadius,
      };

      // Axes are measured from the CENTRE of the stick, like the
      // knob position, angle and force below. They used to be
      // measured from the touch-START point, so wherever the thumb
      // landed became a dead zone of exactly that offset while the
      // knob already showed a deflection the game never received.
      let distX = fingerX - wrapperRadius;
      if (distX > 0 && distX > wrapperRadius) {
        distX = wrapperRadius;
      }
      if (distX < 0 && Math.abs(distX) > wrapperRadius) {
        distX = -wrapperRadius;
      }

      let distY = fingerY - wrapperRadius;
      if (distY > 0 && distY > wrapperRadius) {
        distY = wrapperRadius;
      }
      if (distY < 0 && Math.abs(distY) > wrapperRadius) {
        distY = -wrapperRadius;
      }

      const angle = utils.calcAngle(
        {x: fingerX, y: fingerY},
        {x: wrapperRadius, y: wrapperRadius},
      );

      let dist = utils.calcDistance(
        {x: wrapperRadius, y: wrapperRadius},
        {x: fingerX, y: fingerY},
      );

      dist = Math.min(dist, wrapperRadius);

      // Compute force from the clamped distance so it can never exceed 1.
      const force = dist / (nippleRadius * 2);
      if (dist === wrapperRadius) {
        coordinates = utils.findCoord(
          {x: wrapperRadius, y: wrapperRadius},
          dist,
          angle,
        );
        coordinates = {
          x: coordinates.x - nippleRadius,
          y: coordinates.y - nippleRadius,
        };
      }

      setX(coordinates.x);
      setY(coordinates.y);

      onMove &&
        onMove({
          dist: {
            x: distX / wrapperRadius,
            y: distY / wrapperRadius,
          },
          position: coordinates,
          angle: {
            radian: utils.degreesToRadians(angle),
            degree: angle,
          },
          force,
          type: 'move',
        });
    },
    [nippleRadius, wrapperRadius, onMove],
  );

  const handleTouchEnd = () => {
    setX(wrapperRadius - nippleRadius);
    setY(wrapperRadius - nippleRadius);
    onStop &&
      onStop({
        force: 0,
        dist: {
          x: 0,
          y: 0,
        },
        position: {
          x: 0,
          y: 0,
        },
        angle: {
          radian: 0,
          degree: 0,
        },
        type: 'stop',
      });
  };

  const handleTouchStart = (event: any) => {
    onStart &&
      onStart({
        force: 0,
        dist: {
          x: 0,
          y: 0,
        },
        position: {
          x: 0,
          y: 0,
        },
        angle: {
          radian: 0,
          degree: 0,
        },
        type: 'start',
      });
  };

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onStart(handleTouchStart)
    // onFinalize alone: it fires after a normal end AND on cancellation,
    // so handleTouchEnd runs exactly once per gesture.
    .onFinalize(handleTouchEnd)
    .onTouchesMove(handleTouchMove);
  // The StyleSheet itself is static per radius/colour: it used to be
  // recreated on every touch-move because the knob transform (x/y)
  // was baked into it. The transform is applied separately now.
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          width: 2 * radius,
          height: 2 * radius,
          borderRadius: radius,
          backgroundColor: `${color}55`,
          transform: [{rotateX: '180deg'}],
          ...(style && typeof style === 'object' ? style : {}),
        },
        nipple: {
          height: 2 * nippleRadius,
          width: 2 * nippleRadius,
          borderRadius: nippleRadius,
          backgroundColor: `${color}bb`,
          position: 'absolute',
        },
      }),
    [radius, color, nippleRadius, style],
  );

  const nippleStyle = [
    styles.nipple,
    {transform: [{translateX: x}, {translateY: y}]},
  ];

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.wrapper} {...props}>
        <View pointerEvents="none" style={nippleStyle}></View>
      </View>
    </GestureDetector>
  );
};
