import { Modal, View, type ModalProps } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/lib/colors";

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
 *
 * A non-transparent Modal (the full-screen forms: Pedido, Factura,
 * Ajustes...) draws on Android's default window background — white, even in
 * dark mode — anywhere nothing else paints over it. The screen inside only
 * covers its own SafeAreaView (`edges={["top"]}`, deliberately excluding the
 * bottom so this component's own `paddingBottom: insets.bottom` isn't
 * doubled), which leaves that bottom safe-area strip unpainted. It stays
 * invisible while nothing forces a repaint there, but the keyboard opening
 * or closing does — surfacing it as a white bar that then persists. Painting
 * `C.bg` behind the whole modal, not just that strip, fixes it at the root
 * instead of chasing each repaint trigger. Skipped for `transparent` sheets
 * (pickers, bottom sheets), which already paint their own overlay.
 */
export function KeyboardModal({ children, ...props }: ModalProps) {
  const insets = useSafeAreaInsets();
  const C = useColors();

  return (
    <Modal navigationBarTranslucent statusBarTranslucent {...props}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: props.transparent ? "transparent" : C.bg }} behavior="padding">
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
