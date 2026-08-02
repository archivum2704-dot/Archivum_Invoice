import { Modal, View, KeyboardAvoidingView, Platform, type ModalProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * A Modal that clears the system navigation bar and the keyboard.
 *
 * Two Android specifics, both invisible on iOS:
 *
 * - Expo draws edge-to-edge, so a sheet anchored to the bottom sits *under* the
 *   gesture/navigation bar and its action button becomes unreachable. The
 *   bottom inset is reserved here so every sheet clears it.
 *
 * - The window already resizes itself for the keyboard (softwareKeyboardLayoutMode
 *   defaults to "resize"). Giving KeyboardAvoidingView a behavior on top of that
 *   moved everything twice: the content rose correctly but, on dismissing the
 *   keyboard, the collapsed view restored out of step with the window and left a
 *   blank flickering band where the keyboard had been. Android therefore gets no
 *   behavior and lets the system do the work; only iOS, which does not resize,
 *   needs padding.
 *
 * Drop-in replacement for react-native's Modal.
 */
export function KeyboardModal({ children, ...props }: ModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal {...props}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
