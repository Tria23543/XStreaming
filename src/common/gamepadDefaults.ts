// Factory-default button layout for the custom virtual gamepad.
//
// This is the SINGLE source of the defaults: the layout editor
// (pages/CustomGamepad.jsx) writes layouts starting from these values,
// and the in-game renderer (components/CustomVirtualGamepad.tsx) falls
// back to them when no layout is saved. The two used to keep separate
// copies, and they drifted — the editor's copy placed RightTrigger,
// RightShoulder and B partly off the right edge of the screen, so every
// layout created in the editor rendered those buttons clipped in-game.
export const getDefaultButtons = (width: number, height: number) => {
  const nexusLeft = width * 0.5 - 20;
  const viewLeft = width * 0.5 - 100;
  const menuLeft = width * 0.5 + 60;

  return [
      {
        name: 'LeftTrigger',
        x: 20,
        y: 40,
        scale: 1,
        show: true,
      },
      {
        name: 'RightTrigger',
        x: width - 60,
        y: 40,
        scale: 1,
        show: true,
      },
      {
        name: 'LeftShoulder',
        x: 20,
        y: 100,
        scale: 1,
        show: true,
      },
      {
        name: 'RightShoulder',
        x: width - 60,
        y: 100,
        scale: 1,
        show: true,
      },
      {
        name: 'A',
        x: width - 80,
        y: height - 50,
        scale: 1,
        show: true,
      },
      {
        name: 'B',
        x: width - 40,
        y: height - 90,
        scale: 1,
        show: true,
      },
      {
        name: 'X',
        x: width - 120,
        y: height - 90,
        scale: 1,
        show: true,
      },
      {
        name: 'Y',
        x: width - 80,
        y: height - 130,
        scale: 1,
        show: true,
      },
      {
        name: 'LeftThumb',
        x: 130,
        y: height - 50,
        scale: 1,
        show: true,
      },
      {
        name: 'RightThumb',
        x: width - 210,
        y: height - 50,
        scale: 1,
        show: true,
      },
      {
        name: 'View',
        x: viewLeft,
        y: height - 50,
        scale: 1,
        show: true,
      },
      {
        name: 'Nexus',
        x: nexusLeft,
        y: height - 50,
        scale: 1,
        show: true,
      },
      {
        name: 'Menu',
        x: menuLeft,
        y: height - 50,
        scale: 1,
        show: true,
      },
      {
        name: 'Dpad',
        x: 20,
        y: height - 170,
        width: 100,
        height: 100,
        scale: 1,
        show: true,
      },
      {
        name: 'LeftStick',
        x: 175,
        y: height - 185,
        scale: 1,
        show: true,
      },
      {
        name: 'RightStick',
        x: width - 255,
        y: height - 155,
        scale: 1,
        show: true,
      },
  ];
};

export default getDefaultButtons;
