import { ReactNode } from "react";
import { DimensionValue, KeyboardAvoidingView, Modal, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bottom sheet with the three behaviours every sheet-style modal needs:
 * tap-outside to close, keyboard avoidance (Android runs edge-to-edge on
 * SDK 55+, so the window no longer resizes when the keyboard opens) and
 * bottom safe-area padding so content never sits under the system
 * navigation bar.
 */
export default function Sheet({ visible, onClose, C, children, maxHeight = "88%" }: {
  visible: boolean;
  onClose: () => void;
  C: any;
  children: ReactNode;
  maxHeight?: DimensionValue;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible} animationType="slide" transparent
      statusBarTranslucent navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
        <View style={{
          backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight, overflow: "hidden", paddingBottom: insets.bottom,
        }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12 }} />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
