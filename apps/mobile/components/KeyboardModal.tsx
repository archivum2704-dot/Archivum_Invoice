import { Modal, View, type ModalProps } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A Modal that clears the system navigation bar and the keyboard.
 *
 * Uses react-native-keyboard-controller rather than React Native's own
 * KeyboardAvoidingView. The built-in one only knows the keyboard's final
 * height, so on Android it resized in steps that fought the window's own
 * resize: content rose correctly but dismissing the keyboard left a blank band
 * that lingered before snapping back. The controller follows the keyboard
 * frame-by-frame, so the content tracks it exactly, both ways.
 *
 * `navigationBarTranslucent`/`statusBarTranslucent` are required for the
 * controller to see the keyboard inside a Modal — RN gives modals their own
 * window, and without these the modal opts out of edge-to-edge and reports no
 * keyboard at all.
 *
 * Expo also draws edge-to-edge, so a sheet anchored to the bottom would sit
 * under the gesture bar; the bottom inset is reserved here for every sheet.
 *
 * Drop-in replacement for react-native's Modal.
 */
export function KeyboardModal({ children, ...props }: ModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal navigationBarTranslucent statusBarTranslucent {...props}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
