import { Modal, KeyboardAvoidingView, Platform, type ModalProps } from "react-native";

/**
 * A Modal whose contents move out of the keyboard's way.
 *
 * Android's windowSoftInputMode does not reach inside a Modal — RN renders it
 * in its own window — so a sheet with text fields sat under the keyboard with
 * no way to see what was being typed. Wrapping the contents in a
 * KeyboardAvoidingView fixes it without changing any sheet's layout: the
 * wrapper simply fills the screen the same way the Modal already did.
 *
 * Drop-in replacement for react-native's Modal.
 */
export function KeyboardModal({ children, ...props }: ModalProps) {
  return (
    <Modal {...props}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}
