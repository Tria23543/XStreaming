package com.swmansion.gesturehandler

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.swmansion.gesturehandler.react.RNGestureHandlerButtonViewManager
import com.swmansion.gesturehandler.react.RNGestureHandlerModule
import com.swmansion.gesturehandler.react.RNGestureHandlerRootViewManager

// RN 0.72-compatible registration for react-native-gesture-handler 2.23.1.
//
// The library's shipped packageDeprecated/RNGestureHandlerPackage.kt is
// written against BaseReactPackage / ViewManagerOnDemandReactPackage,
// which only exist in React Native 0.73+. This project runs RN 0.72, where
// packages implement the classic ReactPackage interface instead. This file
// registers exactly the same native module and the same two view managers
// as the shipped class, using the RN 0.72 interface. It is copied over the
// library's file inside node_modules by the Android build workflow only;
// the iOS build never sees it (iOS does not compile the library's
// android/ sources).
class RNGestureHandlerPackage : ReactPackage {
  override fun createNativeModules(
    reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(RNGestureHandlerModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> =
    listOf(
      RNGestureHandlerRootViewManager(),
      RNGestureHandlerButtonViewManager()
    )
}
