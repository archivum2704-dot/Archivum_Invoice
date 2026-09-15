import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { Search as SearchIcon, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { KeyboardModal } from "@/components/KeyboardModal";

export interface PickableProduct {
  id: string;
  name: string;
}

/**
 * Search-and-pick sheet for inventory products, shared by every screen that
 * writes invoice/quote lines (Facturación, Presupuestos/Albaranes).
 *
 * Before this, each screen rendered every product as a horizontally
 * scrolling row of chips with no way to filter it — unusable once a
 * catalog grew past a handful of items. Mirrors the search-driven
 * `ProductPicker` combobox already used on the web app, and the client
 * picker sheet already used in this same screen family.
 */
export function ProductPickerModal<P extends PickableProduct>({ visible, products, onPick, onClose }: {
  visible: boolean;
  products: P[];
  onPick: (product: P) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const C = useColors();
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, search]);

  const close = () => { setSearch(""); onClose(); };

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl - 4, maxHeight: "80%" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: C.text }}>{t("invoicing.product")}</Text>
            <TouchableOpacity onPress={close}><X size={22} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: radius.sm, paddingHorizontal: spacing.sm + 2, marginBottom: spacing.sm + 2 }}>
            <SearchIcon size={15} color={C.muted} strokeWidth={1.75} />
            <TextInput
              placeholder={t("invoicing.searchProduct")}
              placeholderTextColor={C.muted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoFocus
              style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 9, color: C.text }}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}><X size={15} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
            )}
          </View>
          <FlatList
            data={matches}
            keyExtractor={(p) => p.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={{ fontFamily: fonts.regular, color: C.muted, paddingVertical: spacing.md + 2, textAlign: "center" }}>{t("invoicing.noProductMatches")}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => { onPick(item); close(); }} style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ fontFamily: fonts.regular, color: C.text, fontSize: 15 }}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </KeyboardModal>
  );
}
