import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft, Download, Pencil, Trash2,
  FileText,
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/lib/colors";
import { useTranslation } from "react-i18next";

function Field({ label, value, C }: { label: string; value: string | null | undefined; C: any }) {
  if (value == null || value === "") return null;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", padding: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ fontSize: 13, color: C.muted }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "500", color: C.text, textAlign: "right", maxWidth: "55%" }}>{value}</Text>
    </View>
  );
}

export default function DocumentoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc,     setDoc]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const C = useColors();
  const { t } = useTranslation();

  const STATUS: Record<string, { label: string; bg: string; color: string }> = {
    paid:      { label: t("status.paid"),      bg: C.greenL, color: C.green },
    pending:   { label: t("status.pending"),   bg: C.yellowL, color: C.yellow },
    overdue:   { label: t("status.overdue"),   bg: C.redL, color: C.red },
    draft:     { label: t("status.draft"),     bg: C.segmentBg, color: C.muted },
    cancelled: { label: t("status.cancelled"), bg: C.segmentBg, color: C.muted },
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
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <FileText size={48} color={C.muted} />
        <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>{t("documento.notFound")}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.blue }}>{t("common.back")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sm = STATUS[doc.status] ?? STATUS.draft;
  const fmt = (n: number | null | undefined) =>
    n != null ? `€${n.toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—";
  const fmtDate = (s: string | null) =>
    s ? new Date(s.includes("T") ? s : `${s}T12:00:00`).toLocaleDateString("es-ES") : "—";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Nav */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={C.blue} />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: C.text }}>{t("documento.detail")}</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Trash2 size={20} color={C.red} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* PDF preview area */}
        <TouchableOpacity
          onPress={handleDownload}
          style={{
            height: 160, marginHorizontal: 16, marginBottom: 14,
            backgroundColor: C.segmentBg, borderRadius: 14, borderWidth: 1, borderColor: C.border,
            alignItems: "center", justifyContent: "center", gap: 8,
          }}
          disabled={!doc.file_url}
        >
          <FileText size={48} color={C.muted} />
          <Text style={{ fontSize: 12, color: C.muted }}>
            {doc.file_url ? t("documento.openFile") : t("documento.noFile")}
          </Text>
        </TouchableOpacity>

        {/* Amount + status */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>{doc.document_number}</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.text }}>{fmt(doc.total)}</Text>
          </View>
          <View style={{ backgroundColor: sm.bg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: sm.color }}>{sm.label}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 16 }}>
          {[
            { icon: downloading ? <ActivityIndicator size={18} color={C.blue} /> : <Download size={18} color={C.blue} />, label: t("documento.download"), onPress: handleDownload, disabled: !doc.file_url || downloading },
            { icon: <Pencil  size={18} color={C.blue} />, label: t("common.edit"),     onPress: () => router.push(`/(app)/editar/${id}`) },
          ].map((btn) => (
            <TouchableOpacity
              key={btn.label}
              onPress={btn.onPress}
              disabled={btn.disabled}
              style={{
                flex: 1, padding: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
                borderRadius: 10, alignItems: "center", gap: 4, opacity: btn.disabled ? 0.4 : 1,
              }}
            >
              {btn.icon}
              <Text style={{ fontSize: 11, fontWeight: "500", color: C.text }}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Data fields */}
        <View style={{ backgroundColor: C.surface, borderRadius: 14, marginHorizontal: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, padding: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
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
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
