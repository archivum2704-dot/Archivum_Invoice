import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft, Download, Pencil, Trash2,
  FileText, FolderInput,
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import { useColors, type Colors } from "@/lib/colors";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/auth-context";
import { FolderPickerModal, useFolders } from "@/components/FolderPicker";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Button, Card, Badge, EmptyState, type BadgeTone } from "@/components/ui";

function Field({ label, value, C }: { label: string; value: string | null | undefined; C: Colors }) {
  if (value == null || value === "") return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, textAlign: "right", maxWidth: "55%" }}>{value}</Text>
    </View>
  );
}

export default function DocumentoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc,     setDoc]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [folderOpen, setFolderOpen] = useState(false);
  const [moving,     setMoving]     = useState(false);
  const { orgId } = useAuth();
  const { folders, loading: foldersLoading } = useFolders(orgId);
  const C = useColors();
  const { t } = useTranslation();

  const STATUS_LABEL: Record<string, string> = {
    paid:      t("status.paid"),
    pending:   t("status.pending"),
    overdue:   t("status.overdue"),
    draft:     t("status.draft"),
    cancelled: t("status.cancelled"),
  };
  const STATUS_TONE: Record<string, BadgeTone> = {
    paid: "green", pending: "yellow", overdue: "red", draft: "neutral", cancelled: "neutral",
  };

  useEffect(() => {
    if (!id) return;
    supabase
      .from("documents")
      .select("*, companies(name, cif)")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setDoc(data);
        setLoading(false);
      });
  }, [id]);

  const handleDelete = () => {
    Alert.alert(t("documento.deleteTitle"), t("documento.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"), style: "destructive",
        onPress: async () => {
          await supabase.from("documents").delete().eq("id", id);
          router.back();
        },
      },
    ]);
  };

  const [downloading, setDownloading] = useState(false);

  const handleMoveToFolder = async (folderId: string | null) => {
    setMoving(true);
    const { error } = await supabase
      .from("documents")
      .update({ folder_id: folderId, updated_at: new Date().toISOString() })
      .eq("id", id);
    setMoving(false);
    if (error) { Alert.alert(t("common.error"), error.message); return; }
    setDoc((d: any) => d ? { ...d, folder_id: folderId } : d);
  };

  const handleDownload = async () => {
    if (!doc?.file_url) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_url, 3600);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");

      // Determine filename from path
      const parts = doc.file_url.split("/");
      const filename = parts[parts.length - 1] || "document.pdf";
      const localUri = FileSystem.cacheDirectory + filename;

      // Download to device cache
      const download = await FileSystem.downloadAsync(data.signedUrl, localUri);
      if (download.status !== 200) throw new Error("Download failed");

      // Open native share sheet so user can save/open
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri, {
          mimeType: download.headers?.["content-type"] || "application/pdf",
          UTI: "public.data",
        });
      } else {
        Alert.alert(t("common.error"), t("documento.downloadError"));
      }
    } catch {
      Alert.alert(t("common.error"), t("documento.downloadError"));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  if (!doc) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1, justifyContent: "center" }}>
          <EmptyState
            icon={<FileText size={28} color={C.muted} strokeWidth={1.5} />}
            title={t("documento.notFound")}
            action={<Button label={t("common.back")} onPress={() => router.back()} size="md" fullWidth={false} />}
          />
        </View>
      </SafeAreaView>
    );
  }

  const label = STATUS_LABEL[doc.status] ?? STATUS_LABEL.draft;
  const tone = STATUS_TONE[doc.status] ?? "neutral";
  const fmt = (n: number | null | undefined) =>
    n != null ? `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—";
  const fmtDate = (s: string | null) =>
    s ? new Date(s.includes("T") ? s : `${s}T12:00:00`).toLocaleDateString("es-ES") : "—";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Nav */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={C.blue} strokeWidth={1.75} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: C.text }}>{t("documento.detail")}</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Trash2 size={20} color={C.red} strokeWidth={1.75} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* PDF preview area */}
        <Card padded={false} containerStyle={{ marginHorizontal: spacing.lg, marginBottom: spacing.md + 2 }}>
          <TouchableOpacity
            onPress={handleDownload}
            style={{ height: 160, alignItems: "center", justifyContent: "center", gap: spacing.sm }}
            disabled={!doc.file_url}
          >
            <FileText size={48} color={C.muted} strokeWidth={1.75} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>
              {doc.file_url ? t("documento.openFile") : t("documento.noFile")}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Amount + status */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <View>
            <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: C.muted }}>{doc.document_number}</Text>
            <Text style={{ fontFamily: fonts.extrabold, fontSize: 24, color: C.text }}>{fmt(doc.total)}</Text>
          </View>
          <Badge label={label} tone={tone} />
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          {[
            { icon: downloading ? <ActivityIndicator size={18} color={C.blue} /> : <Download size={18} color={C.blue} strokeWidth={1.75} />, label: t("documento.download"), onPress: handleDownload, disabled: !doc.file_url || downloading },
            { icon: <Pencil  size={18} color={C.blue} strokeWidth={1.75} />, label: t("common.edit"),     onPress: () => router.push(`/(app)/editar/${id}`) },
            { icon: moving ? <ActivityIndicator size={18} color={C.blue} /> : <FolderInput size={18} color={C.blue} strokeWidth={1.75} />, label: t("biblioteca.moveShort"), onPress: () => setFolderOpen(true), disabled: moving },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.label}
              onPress={btn.onPress}
              disabled={btn.disabled}
              style={{
                flex: 1, padding: spacing.sm + 2, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
                borderRadius: radius.md, alignItems: "center", gap: spacing.xs, opacity: btn.disabled ? 0.4 : 1,
              }}
            >
              {btn.icon}
              <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: C.text }}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Data fields */}
        <Card padded={false} containerStyle={{ marginHorizontal: spacing.lg }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, padding: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border }}>
            {t("documento.info")}
          </Text>
          <Field C={C} label={t("documento.type")} value={t(`docTypes.${doc.document_type}`, { defaultValue: doc.document_type })} />
          <Field C={C} label={t("documento.company")} value={doc.companies?.name} />
          <Field C={C} label={t("documento.supplierCif")} value={doc.companies?.cif} />
          <Field C={C} label={t("documento.issueDate")} value={fmtDate(doc.issue_date)} />
          <Field C={C} label={t("documento.dueDate")} value={fmtDate(doc.due_date)} />
          <Field C={C} label={t("documento.paymentDate")} value={fmtDate(doc.payment_date)} />
          <Field C={C} label={t("documento.subtotal")} value={doc.subtotal != null ? fmt(doc.subtotal) : null} />
          <Field C={C} label={`${t("documento.vat")} (${doc.tax_rate ?? 0}%)`} value={
            doc.tax_amount != null
              ? fmt(doc.tax_amount)
              : doc.subtotal != null && doc.tax_rate != null
                ? fmt(doc.subtotal * doc.tax_rate / 100)
                : null
          } />
          <Field C={C} label={t("documento.total")} value={fmt(doc.total)} />
          <Field C={C} label={t("documento.notes")} value={doc.notes} />
          <Field C={C} label={t("documento.description")} value={doc.description} />
        </Card>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
      <FolderPickerModal
        visible={folderOpen}
        folders={folders}
        current={doc?.folder_id ?? null}
        loading={foldersLoading}
        onSelect={handleMoveToFolder}
        onClose={() => setFolderOpen(false)}
      />
    </SafeAreaView>
  );
}
