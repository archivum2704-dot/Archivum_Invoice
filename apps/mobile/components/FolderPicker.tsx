import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from "react-native";
import { Folder as FolderIcon, Check, FolderMinus, FolderPlus } from "lucide-react-native";
import { Button } from "@/components/ui";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { KeyboardModal } from "@/components/KeyboardModal";

export interface Folder { id: string; name: string }

/** Loads the folders this member can reach. RLS scopes the list already. */
export function useFolders(orgId: string | null) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  /** Adds a folder created elsewhere (e.g. from the picker) without a reload. */
  const addFolder = (f: Folder) =>
    setFolders(prev => [...prev.filter(x => x.id !== f.id), f].sort((a, b) => a.name.localeCompare(b.name)));

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

  return { folders, loading, addFolder };
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
  visible, folders, current, onSelect, onClose, loading, createInOrg, onFolderCreated,
}: {
  visible: boolean;
  folders: Folder[];
  current: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
  loading?: boolean;
  /**
   * When set, the sheet offers "Nueva carpeta" and creates it in this
   * organization. Creating a folder used to mean abandoning the upload in
   * progress, going to Biblioteca and starting again (APP-002).
   */
  createInOrg?: string | null;
  onFolderCreated?: (folder: Folder) => void;
}) {
  const C = useColors();
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!visible) { setCreating(false); setNewName(""); } }, [visible]);

  const createFolder = async () => {
    const name = newName.trim();
    if (!name || !createInOrg) return;
    setSaving(true);
    const { data, error } = await supabase.from("folders")
      .insert({ organization_id: createInOrg, name }).select("id, name").single();
    setSaving(false);
    if (error || !data) { Alert.alert(t("common.error"), error?.message ?? t("common.unknownError")); return; }
    onFolderCreated?.(data as Folder);
    onSelect((data as Folder).id);
    onClose();
  };

  const row = (key: string, label: string, icon: React.ReactNode, selected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={key}
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: spacing.md,
        paddingHorizontal: spacing.xl - 4, paddingVertical: spacing.md + 2,
        borderBottomWidth: 1, borderBottomColor: C.border,
      }}
    >
      {icon}
      <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: C.text }} numberOfLines={1}>{label}</Text>
      {selected && <Check size={18} color={C.blue} strokeWidth={1.75} />}
    </TouchableOpacity>
  );

  return (
    <KeyboardModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: C.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "70%", paddingBottom: spacing.md }}>
        <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: spacing.md, marginBottom: spacing.sm }} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: C.text, paddingHorizontal: spacing.xl - 4, paddingBottom: spacing.md }}>
          {t("biblioteca.moveToFolder")}
        </Text>

        {loading ? (
          <View style={{ paddingVertical: spacing.xxl - 2, alignItems: "center" }}>
            <ActivityIndicator color={C.blue} />
          </View>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled">
            {!!createInOrg && (creating ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.xl - 4, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  placeholder={t("biblioteca.folderNamePlaceholder")}
                  placeholderTextColor={C.muted}
                  onSubmitEditing={createFolder}
                  returnKeyType="done"
                  style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: C.text, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 9 }}
                />
                <Button label={t("common.create")} onPress={createFolder} disabled={!newName.trim()} loading={saving} size="md" fullWidth={false} />
              </View>
            ) : row("new", t("biblioteca.newFolder"), <FolderPlus size={17} color={C.blue} strokeWidth={1.75} />, false, () => setCreating(true)))}
            {row("none", t("biblioteca.noFolder"), <FolderMinus size={17} color={C.muted} strokeWidth={1.75} />, current == null, () => { onSelect(null); onClose(); })}
            {folders.map(f =>
              row(f.id, f.name, <FolderIcon size={17} color={C.muted} strokeWidth={1.75} />, current === f.id, () => { onSelect(f.id); onClose(); }),
            )}
            {folders.length === 0 && (
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted, textAlign: "center", paddingVertical: spacing.xl, paddingHorizontal: spacing.xl }}>
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
  folders, value, onChange, loading, style, createInOrg, onFolderCreated,
}: {
  folders: Folder[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  loading?: boolean;
  style?: object;
  createInOrg?: string | null;
  onFolderCreated?: (folder: Folder) => void;
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
          flexDirection: "row", alignItems: "center", gap: spacing.sm,
          backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
          borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11,
        }, style]}
      >
        <FolderIcon size={15} color={C.muted} strokeWidth={1.75} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: name ? C.text : C.muted }} numberOfLines={1}>
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
        createInOrg={createInOrg}
        onFolderCreated={onFolderCreated}
      />
    </>
  );
}
