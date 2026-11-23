import React from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {
  Button,
  IconButton,
  RadioButton,
  Text,
  Divider,
  Portal,
  Modal,
  Card,
  HelperText,
  TextInput,
} from 'react-native-paper';
import {useTranslation} from 'react-i18next';
import {useIsFocused} from '@react-navigation/native';
import {
  getSettings as getUserSettings,
  saveSettings as saveUserSettings,
} from '../store/settingStore';
import {getSettings} from '../store/gamepadStore';

function VirtualGamepadSettingsScreen({navigation, route}) {
  const {t} = useTranslation();
  const [value, setValue] = React.useState('');
  const [name, setName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);
  const [userSettings, setUserSettings] = React.useState({});
  const [settings, setSettings] = React.useState([]);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const navTimer = React.useRef(null);
  const isFocused = useIsFocused();

  React.useEffect(() => {
    return () => {
      if (navTimer.current) {
        clearTimeout(navTimer.current);
        navTimer.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="plus"
          size={28}
          onPress={() => {
            setShowAddModal(true);
          }}
        />
      ),
    });
  }, [navigation]);

  // Reload the layout list every time this page is shown, so layouts that
  // were just created, edited or deleted in the editor appear correctly.
  React.useEffect(() => {
    if (!isFocused) {
      return;
    }
    const _settings = getSettings();
    setSettings(Object.keys(_settings));

    const _userSettings = getUserSettings();
    setUserSettings(_userSettings);
    setValue(_userSettings.custom_virtual_gamepad || '');
  }, [isFocused]);

  const handleSave = () => {
    userSettings.custom_virtual_gamepad = value;
    setUserSettings(userSettings);
    saveUserSettings(userSettings);
    navigation.goBack();
  };

  const handleEdit = () => {
    navigation.navigate('CustomGamepad', {name: value});
  };

  const onChangeText = text => {
    setNameTouched(true);
    setName(text);
  };

  let errorText = '';
  let isError = false;
  if (!name.trim()) {
    isError = true;
    errorText = t('Name can not be empty');
  } else if (
    // Case-insensitive: "Layout" and "layout" must not coexist as two
    // different layouts.
    settings.some(s => s.toLowerCase() === name.trim().toLowerCase())
  ) {
    isError = true;
    errorText = t('Name already exists');
  }

  return (
    <View style={styles.container}>
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => {
            setShowAddModal(false);
            setName('');
            setNameTouched(false);
          }}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <TextInput label="" value={name} onChangeText={onChangeText} />
              <HelperText type="error" visible={isError && nameTouched}>
                {errorText}
              </HelperText>

              <Button
                mode="contained"
                disabled={isError}
                style={{marginTop: 20}}
                onPress={() => {
                  setNameTouched(true);
                  if (!isError) {
                    const newName = name.trim();
                    setShowAddModal(false);
                    // Clear the field so reopening the dialog does not
                    // show the just-created name (and instantly flag it
                    // as already existing).
                    setName('');
                    setNameTouched(false);
                    navTimer.current = setTimeout(() => {
                      navTimer.current = null;
                      navigation.navigate('CustomGamepad', {
                        name: newName,
                      });
                    }, 300);
                  }
                }}>
                {t('Confirm')}
              </Button>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <ScrollView style={styles.scrollView}>
        <View style={styles.tips}>
          <Text>{t('Customize buttons of virtual gamepad')}</Text>
        </View>
        <Divider />

        <RadioButton.Group onValueChange={val => setValue(val)} value={value}>
          <RadioButton.Item label={t('Default')} value={''} />
          {settings.map(s => {
            return <RadioButton.Item key={s} label={s} value={s} />;
          })}
        </RadioButton.Group>
      </ScrollView>

      <View style={styles.buttonWrap}>
        <Button mode="contained" style={styles.button} onPress={handleSave}>
          {t('Select')}
        </Button>
        {value !== '' && (
          <Button mode="outlined" style={styles.button} onPress={handleEdit}>
            {t('Edit')}
          </Button>
        )}
        <Button
          mode="outlined"
          style={styles.button}
          onPress={() => navigation.goBack()}>
          {t('Back')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tips: {
    padding: 10,
  },
  scrollView: {
    marginBottom: 120,
  },
  sliderTitle: {
    padding: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  buttonWrap: {
    position: 'absolute',
    left: 0,
    width: '100%',
    bottom: 20,
    paddingLeft: 10,
    paddingRight: 10,
  },
  button: {
    marginTop: 10,
  },
});

export default VirtualGamepadSettingsScreen;
