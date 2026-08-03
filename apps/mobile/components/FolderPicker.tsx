import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { Folder as FolderIcon, Check, FolderMinus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { KeyboardModal } from "@/components/KeyboardModal";

export interface Folder { id: string; name: string }

/** Loads the folders this member can reach. RLS scopes the list already. */
export function useFolders(orgId: string | null) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) { setFolders([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase.from("folders").select("id, name").eq("organization_id", orgId).order("name")
      .then(({ data }) => {
        if (cancelled) return;
        setFolders((data ?? []) as Folder[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [orgId]);

  return { folders, loading };
}

/**
 * Sheet for choosing which folder a document belongs to.
 *
 * Shared by the upload flow and the document detail so a document can be filed
 * when it is created and re-filed afterwards — folders were previously
 * something you could create and filter by, but never actually put anything in
 * from the phone.
 */
export function FolderPickerModal({
  visible, folders, current, onSelect, onClose, loading,
}: {
  visible: boolean;
  folders: Folder[];
  current: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
  loading?: boolean;
}) {
  const C = useColors();
  const { t } = useTranslation();

  const row = (key: string, label: string, icon: React.ReactNode, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}
    >
      {icon}
      <Text style={{ flex: 1, fontSize: 15, color: C.text }} numberOfLines={1}>{label}</Text>
      {selected && <Check size={18} color={C.blue} />}
    </TouchableOpacity>
  );

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "70%", paddingBottom: 12 }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 }} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: C.text, paddingHorizontal: 20, paddingBottom: 12 }}>
          {t("biblioteca.moveToFolder")}
        </Text>

        {loading ? (
          <View style={{ paddingVertical: 30, alignItems: "center" }}>
            <ActivityIndicator color={C.blue} />
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled">
            {row("none", t("biblioteca.noFolder"), <FolderMinus size={17} color={C.muted} />, current == null, () => { onSelect(null); onClose(); })}
            {folders.map(f =>
              row(f.id, f.name, <FolderIcon size={17} color={C.muted} />, current === f.id, () => { onSelect(f.id); onClose(); }),
            )}
            {folders.length === 0 && (
              <Text style={{ fontSize: 13, color: C.muted, textAlign: "center", paddingVertical: 24, paddingHorizontal: 24 }}>
                {t("biblioteca.noFoldersYet")}
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardModal>
  );
}

/** Field that shows the current folder and opens the picker. */
export function FolderField({
  folders, value, onChange, loading, style,
}: {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  loading?: boolean;
  style?: object;
}) {
  const C = useColors();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const name = folders.find(f => f.id === value)?.name;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
          borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
        }, style]}
      >
        <FolderIcon size={15} color={C.muted} />
        <Text style={{ flex: 1, fontSize: 15, color: name ? C.text : C.muted }} numberOfLines={1}>
          {name ?? t("biblioteca.noFolder")}
        </Text>
      </TouchableOpacity>

      <FolderPickerModal
        visible={open}
        folders={folders}
        current={value}
        loading={loading}
        onSelect={onChange}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
