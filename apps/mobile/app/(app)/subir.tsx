import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, BackHandler,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { PDFDocument } from "pdf-lib";
import {
  ChevronLeft, Camera, Image as ImageIcon, FileText, Check,
  Upload, X, AlertTriangle, Building2, Plus,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { Button, Card, Input } from "@/components/ui";
import { RequirePermission } from "@/components/RequirePermission";
import { DateField } from "@/components/DateField";
import { FolderField, useFolders } from "@/components/FolderPicker";

interface Company { id: string; name: string; }

/* ── Convert any image URI to a PDF using pdf-lib (pure JS, no native) ─── */
async function convertImageToPdf(imageUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
  const ext = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const isJpeg = ext !== "png";

  const pdfDoc = await PDFDocument.create();
  const img = isJpeg
    ? await pdfDoc.embedJpg(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
    : await pdfDoc.embedPng(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));

  const A4_W = 595, A4_H = 842, MARGIN = 24;
  const maxW = A4_W - MARGIN * 2, maxH = A4_H - MARGIN * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale, h = img.height * scale;

  const page = pdfDoc.addPage([A4_W, A4_H]);
  page.drawImage(img, { x: (A4_W - w) / 2, y: (A4_H - h) / 2, width: w, height: h });

  const pdfBytes = await pdfDoc.save();
  let binary = "";
  for (let i = 0; i < pdfBytes.length; i++) binary += String.fromCharCode(pdfBytes[i]);
  const pdfBase64 = btoa(binary);

  const outUri = FileSystem.cacheDirectory + `doc_${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(outUri, pdfBase64, { encoding: 'base64' });
  return outUri;
}

/* ── Step indicator ─────────────────────────────────────────────────────── */
function StepIndicator({ current, C, t }: { current: number; C: any; t: any }) {
  const steps = [t("subir.stepFile"), t("subir.stepMeta"), t("subir.stepConfirm")];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: spacing.lg, marginBottom: spacing.lg }}>
      {steps.map((s, i) => {
        const done   = i + 1 < current;
        const active = i + 1 === current;
        return (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <View style={{ alignItems: "center", gap: spacing.xs }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
                backgroundColor: done || active ? C.blue : C.surface,
                borderWidth: done || active ? 0 : 2, borderColor: C.border,
              }}>
                {done
                  ? <Check size={14} color="#fff" strokeWidth={1.75} />
                  : <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: active ? "#fff" : C.muted }}>{i + 1}</Text>
                }
              </View>
              <Text style={{ fontFamily: active ? fonts.bold : fonts.regular, fontSize: 10, color: active ? C.blue : C.muted }}>{s}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={{ flex: 1, height: 2, marginBottom: 14, marginHorizontal: spacing.xs, backgroundColor: i + 1 < current ? C.blue : C.border }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

/* ── Step 1: File selection ──────────────────────────────────────────────── */
function Step1({ onNext, pickedFile, setPickedFile, C, t }: {
  onNext: () => void; pickedFile: PickedFile | null; setPickedFile: (f: PickedFile | null) => void; C: any; t: any;
}) {
  const [converting, setConverting] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert(t("common.error"), t("subir.errorCamera")); return; }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert(t("common.error"), t("subir.errorCamera")); return; }
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setConverting(true);
      try {
        const pdfUri = await convertImageToPdf(asset.uri);
        const info = await FileSystem.getInfoAsync(pdfUri);
        const name = (asset.fileName ?? "imagen").replace(/\.[^.]+$/, "") + ".pdf";
        setPickedFile({ uri: pdfUri, name, size: (info as any).size ?? 0, mimeType: "application/pdf" });
      } catch {
        const info = await FileSystem.getInfoAsync(asset.uri);
        setPickedFile({ uri: asset.uri, name: asset.fileName ?? "imagen.jpg", size: (info as any).size ?? 0, mimeType: asset.mimeType ?? "image/jpeg" });
      } finally { setConverting(false); }
    } catch { Alert.alert(t("common.error"), t("subir.errorCamera")); }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "text/csv",
          "text/plain",
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.mimeType?.startsWith("image/")) {
        setConverting(true);
        try {
          const pdfUri = await convertImageToPdf(asset.uri);
          const info = await FileSystem.getInfoAsync(pdfUri);
          setPickedFile({ uri: pdfUri, name: asset.name.replace(/\.[^.]+$/, "") + ".pdf", size: (info as any).size ?? 0, mimeType: "application/pdf" });
        } catch {
          setPickedFile({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? "application/pdf" });
        } finally { setConverting(false); }
      } else {
        setPickedFile({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? "application/pdf" });
      }
    } catch { Alert.alert(t("common.error"), t("subir.errorFile")); }
  };

  const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

  return (
    <View style={{ padding: spacing.lg, gap: spacing.lg }}>
      <TouchableOpacity
        onPress={pickDocument}
        style={{ borderWidth: 2, borderStyle: "dashed", borderColor: C.blue, borderRadius: radius.lg, padding: spacing.xxl, alignItems: "center", gap: spacing.md, backgroundColor: C.blueL }}
      >
        {converting ? (
          <><ActivityIndicator size="large" color={C.blue} /><Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.blue }}>{t("subir.convertingPdf")}</Text></>
        ) : pickedFile ? (
          <>
            <View style={{ width: 48, height: 60, backgroundColor: C.blueMed, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" }}><FileText size={24} color={C.blue} strokeWidth={1.75} /></View>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: C.blue }} numberOfLines={1}>{pickedFile.name}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{(pickedFile.name.split(".").pop() ?? "FILE").toUpperCase()} · {formatSize(pickedFile.size)}</Text>
            <TouchableOpacity onPress={() => setPickedFile(null)} style={{ position: "absolute", top: spacing.md, right: spacing.md }}><X size={16} color={C.muted} strokeWidth={1.75} /></TouchableOpacity>
          </>
        ) : (
          <>
            <Upload size={40} color={C.blue} strokeWidth={1.75} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: C.blue }}>{t("subir.tapToSelect")}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{t("subir.fileHint")}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: C.blue, marginTop: 2 }}>{t("subir.autoConvert")}</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ flexDirection: "row", gap: spacing.sm + 2 }}>
        {[
          { label: t("subir.camera"),  onPress: () => pickImage(true),  icon: <Camera size={22} color={C.blue} strokeWidth={1.75} /> },
          { label: t("subir.gallery"), onPress: () => pickImage(false), icon: <ImageIcon size={22} color={C.blue} strokeWidth={1.75} /> },
          { label: t("subir.files"),   onPress: pickDocument,           icon: <FileText size={22} color={C.blue} strokeWidth={1.75} /> },
        ].map(({ label, onPress, icon }) => (
          <TouchableOpacity key={label} onPress={onPress} disabled={converting}
            style={{ flex: 1, padding: spacing.md + 2, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: radius.md, alignItems: "center", gap: spacing.xs + 2, opacity: converting ? 0.5 : 1 }}>
            {icon}
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: C.text }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Button label={t("subir.continue")} onPress={onNext} disabled={converting} />
    </View>
  );
}

/* ── Company selector (matches web behaviour) ───────────────────────────── */
function CompanyPicker({ companies, companyId, setCompanyId, onCreate, creating, C, t }: {
  companies: Company[]; companyId: string | null; setCompanyId: (id: string | null) => void;
  onCreate: (name: string) => Promise<void>; creating: boolean; C: any; t: any;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const submitNew = async () => {
    if (!newName.trim()) return;
    await onCreate(newName.trim());
    setNewName("");
    setAdding(false);
  };

  return (
    <View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: C.muted, marginBottom: spacing.xs + 2 }}>
        <Building2 size={12} color={C.muted} strokeWidth={1.75} /> {t("subir.companyLabel")}
      </Text>

      {companies.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {companies.map((c) => (
              <TouchableOpacity key={c.id} onPress={() => setCompanyId(companyId === c.id ? null : c.id)}
                style={{ paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: companyId === c.id ? C.blue : C.border, backgroundColor: companyId === c.id ? C.blue : C.surface }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: companyId === c.id ? "#fff" : C.muted }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {companies.length === 0 && !adding && (
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginBottom: spacing.sm }}>{t("subir.noCompanies")}</Text>
      )}

      {adding ? (
        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <TextInput
            style={{ flex: 1, borderWidth: 1.5, borderColor: C.blue, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 15, color: C.text, backgroundColor: C.inputBg }}
            placeholder={t("subir.newCompanyPlaceholder")} placeholderTextColor={C.muted}
            value={newName} onChangeText={setNewName} autoFocus onSubmitEditing={submitNew} returnKeyType="done"
          />
          <TouchableOpacity onPress={submitNew} disabled={creating || !newName.trim()}
            style={{ backgroundColor: newName.trim() ? C.blue : C.border, borderRadius: radius.md, paddingHorizontal: spacing.md + 2, paddingVertical: spacing.md }}>
            {creating ? <ActivityIndicator color="#fff" size="small" /> : <Check size={18} color="#fff" strokeWidth={1.75} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setAdding(false); setNewName(""); }} style={{ padding: spacing.sm }}>
            <X size={18} color={C.muted} strokeWidth={1.75} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setAdding(true)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Plus size={14} color={C.blue} strokeWidth={1.75} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.blue }}>
            {companies.length === 0 ? t("subir.addFirstCompany") : t("subir.newCompany")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ── Step 2: Metadata ───────────────────────────────────────────────────── */
function Step2({ onNext, onBack, docType, setDocType, docNumber, setDocNumber, companies, companyId, setCompanyId, onCreateCompany, creatingCompany, amount, setAmount, taxable, setTaxable, vatRate, setVatRate, issueDate, setIssueDate, dueDate, setDueDate, status, setStatus, notes, setNotes, folders, folderId, setFolderId, foldersLoading, pickedFile, C, t }: any) {
  const DOC_TYPES = [
    { key: "invoice_received", label: t("docTypes.invoice_received") },
    { key: "invoice_issued",   label: t("docTypes.invoice_issued") },
    { key: "delivery_note",    label: t("docTypes.delivery_note") },
    { key: "order",            label: t("docTypes.order") },
    { key: "receipt",          label: t("docTypes.receipt") },
    { key: "quote",            label: t("docTypes.quote") },
    { key: "payroll",          label: t("docTypes.payroll") },
    { key: "contract",         label: t("docTypes.contract") },
    { key: "other",            label: t("docTypes.other") },
  ];
  const STATUSES = [
    { key: "draft",   label: t("status.draft") },
    { key: "pending", label: t("status.pending") },
    { key: "paid",    label: t("status.paid") },
  ];

  const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  const labelStyle = { fontFamily: fonts.medium, fontSize: 12, color: C.muted, marginBottom: spacing.xs + 2 };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ padding: spacing.lg, gap: spacing.md + 2 }}>
        {/* File thumb */}
        <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ width: 44, height: 56, backgroundColor: C.blueL, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" }}><FileText size={20} color={C.blue} strokeWidth={1.75} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: C.text }} numberOfLines={1}>{pickedFile?.name ?? t("subir.noFile")}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted }}>{pickedFile ? `${(pickedFile.name.split(".").pop() ?? "FILE").toUpperCase()} · ${formatSize(pickedFile.size)}` : "—"}</Text>
          </View>
        </Card>

        {/* Doc type */}
        <View>
          <Text style={labelStyle}>{t("subir.docTypeLabel")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {DOC_TYPES.map((dt) => (
                <TouchableOpacity key={dt.key} onPress={() => setDocType(dt.key)}
                  style={{ paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: docType === dt.key ? C.blue : C.border, backgroundColor: docType === dt.key ? C.blue : C.surface }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: docType === dt.key ? "#fff" : C.muted }}>{dt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Company selector */}
        <CompanyPicker companies={companies} companyId={companyId} setCompanyId={setCompanyId} onCreate={onCreateCompany} creating={creatingCompany} C={C} t={t} />

        {[
          { label: t("subir.docNumberLabel"), value: docNumber, setter: setDocNumber, ph: "FAC-2025-0001" },
          { label: t("subir.totalLabel"),     value: amount, setter: setAmount, ph: "4280.00", keyboard: "numeric" },
          { label: t("subir.subtotalLabel"),  value: taxable, setter: setTaxable, ph: "3537.19", keyboard: "numeric" },
          { label: t("subir.vatLabel"),       value: vatRate, setter: setVatRate, ph: "21", keyboard: "numeric" },
        ].map((f) => (
          <Input
            key={f.label}
            label={f.label}
            placeholder={f.ph}
            value={f.value}
            onChangeText={f.setter}
            keyboardType={(f.keyboard as any) ?? "default"}
          />
        ))}

        <View>
          <Text style={labelStyle}>{t("subir.issueDateLabel")}</Text>
          <DateField value={issueDate} onChange={(v) => setIssueDate(v ?? "")} />
        </View>
        <View>
          <Text style={labelStyle}>{t("subir.dueDateLabel")}</Text>
          <DateField value={dueDate} onChange={(v) => setDueDate(v ?? "")} />
        </View>

        <View>
          <Text style={labelStyle}>{t("biblioteca.folderLabel")}</Text>
          <FolderField folders={folders} value={folderId} onChange={setFolderId} loading={foldersLoading} />
        </View>

        {/* Status */}
        <View>
          <Text style={labelStyle}>{t("subir.statusLabel")}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {STATUSES.map((s) => (
              <TouchableOpacity key={s.key} onPress={() => setStatus(s.key)}
                style={{ paddingHorizontal: spacing.md + 2, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: status === s.key ? C.blue : C.border, backgroundColor: status === s.key ? C.blue : C.surface }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: status === s.key ? "#fff" : C.muted }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Input
          label={t("subir.notesLabel")}
          placeholder={t("subir.notesPlaceholder")}
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 60 }}
        />

        <Button label={t("subir.continue")} onPress={onNext} />
        <Button label={t("subir.back")} onPress={onBack} variant="secondary" />
        <View style={{ height: spacing.sm }} />
      </View>
    </ScrollView>
  );
}

/* ── Step 3: Confirm ────────────────────────────────────────────────────── */
function Step3({ onSubmit, onBack, saving, pickedFile, docType, docNumber, companyName, amount, issueDate, dueDate, status, notes, C, t }: any) {
  const formatSize = (bytes: number) => bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

  const rows = [
    [t("subir.docTypeLabel").replace(" *", ""), t(`docTypes.${docType}`, { defaultValue: docType })],
    [t("subir.docNumberLabel").replace(" *", ""), docNumber || "—"],
    [t("subir.companyLabel").replace(" *", ""), companyName || "—"],
    [t("subir.issueDateLabel"), issueDate || "—"],
    [t("subir.dueDateLabel"), dueDate || "—"],
    [t("subir.totalLabel"), amount ? `€${parseFloat(amount.replace(",", ".")).toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—"],
    [t("subir.statusLabel"), t(`status.${status}`, { defaultValue: status })],
  ];

  return (
    <View style={{ padding: spacing.lg, gap: spacing.md + 2 }}>
      <Card padded={false}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: C.text, padding: spacing.md + 2, paddingBottom: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>{t("subir.summary")}</Text>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", padding: spacing.sm + 3, paddingHorizontal: spacing.md + 2, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.muted }}>{k}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text }}>{v}</Text>
          </View>
        ))}
      </Card>

      {pickedFile && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, backgroundColor: C.blueL, borderRadius: radius.md, padding: spacing.md }}>
          <FileText size={20} color={C.blue} strokeWidth={1.75} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.blue, flex: 1 }} numberOfLines={1}>{pickedFile.name} · {formatSize(pickedFile.size)}</Text>
        </View>
      )}

      {notes ? (
        <Card>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.muted, marginBottom: spacing.xs }}>{t("subir.notesLabel")}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.text }}>{notes}</Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", backgroundColor: C.blueL, borderRadius: radius.md, padding: spacing.md }}>
        <AlertTriangle size={16} color={C.blue} strokeWidth={1.75} style={{ marginTop: 1 }} />
        <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: C.text, flex: 1, lineHeight: 17 }}>{t("subir.archiveReminder")}</Text>
      </View>

      <Button
        label={t("subir.archive")}
        onPress={onSubmit}
        loading={saving}
        icon={<Check size={18} color="#fff" strokeWidth={1.75} />}
        style={{ backgroundColor: C.green }}
      />
      <Button label={t("subir.editData")} onPress={onBack} variant="secondary" />
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
function SubirScreenContent() {
  const { t } = useTranslation();
  const C = useColors();
  const { orgId } = useAuth();
  const [step, setStep] = useState(1);

  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);
  const [quotaOk,  setQuotaOk]  = useState(true);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);

  // Companies
  const [companies,       setCompanies]       = useState<Company[]>([]);
  const [companyId,       setCompanyId]       = useState<string | null>(null);
  const [creatingCompany, setCreatingCompany] = useState(false);

  // Form fields
  const [docType,     setDocType]     = useState("invoice_received");
  const [docNumber,   setDocNumber]   = useState("");
  const [amount,      setAmount]      = useState("");
  const [taxable,     setTaxable]     = useState("");
  const [vatRate,     setVatRate]     = useState("21");
  const [issueDate,   setIssueDate]   = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const [folderId,    setFolderId]    = useState<string | null>(null);
  const { folders, loading: foldersLoading } = useFolders(orgId);
  const [status,      setStatus]      = useState("pending");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  const loadCompanies = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .eq("organization_id", orgId)
      .order("name");
    setCompanies(data ?? []);
  }, [orgId]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const handleCreateCompany = async (name: string) => {
    if (!orgId) { Alert.alert(t("common.error"), t("common.unknownError")); return; }
    setCreatingCompany(true);
    const { data, error } = await supabase
      .from("companies")
      .insert({ organization_id: orgId, name, is_active: true })
      .select("id, name")
      .single();
    setCreatingCompany(false);
    if (error || !data) { Alert.alert(t("common.error"), error?.message ?? t("common.unknownError")); return; }
    setCompanies((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setCompanyId(data.id);
  };

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data: org } = await supabase
        .from("organizations")
        .select("doc_quota_pool, subscription_status, current_period_end")
        .eq("id", orgId).single();
      if (!org) return;
      const now = new Date();
      const periodEnd = org.current_period_end ? new Date(org.current_period_end) : null;
      const isExpired = ["canceled", "unpaid"].includes(org.subscription_status ?? "") && periodEnd && now > periodEnd;
      if (isExpired) { setQuotaOk(false); setQuotaMsg(t("subir.quotaExpired")); return; }
      if ((org.doc_quota_pool ?? 0) <= 0) { setQuotaOk(false); setQuotaMsg(t("subir.quotaReached")); }
    })();
  }, [orgId]);

  const handleSubmit = async () => {
    if (!orgId || !quotaOk) return;
    setSaving(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let fileType: string | null = null;

      if (pickedFile) {
        const storagePath = `${orgId}/${Date.now()}_${pickedFile.name}`;
        const fileContent = await FileSystem.readAsStringAsync(pickedFile.uri, { encoding: 'base64' });
        const binary = atob(fileContent);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const { error: storageErr } = await supabase.storage.from("documents").upload(storagePath, bytes, { contentType: pickedFile.mimeType, upsert: false });
        if (storageErr) throw storageErr;
        fileUrl = storagePath; fileName = pickedFile.name; fileSize = pickedFile.size; fileType = pickedFile.mimeType;
      }

      const baseAmount = taxable ? parseFloat(taxable.replace(",", ".")) : null;
      const rate = vatRate ? parseFloat(vatRate.replace(",", ".")) : null;
      const taxAmount = baseAmount != null && rate != null ? baseAmount * rate / 100 : null;
      const totalVal = amount ? parseFloat(amount.replace(",", ".")) : (baseAmount != null ? baseAmount + (taxAmount ?? 0) : null);

      const { error: insertErr } = await supabase.from("documents").insert({
        organization_id: orgId, company_id: companyId,
        document_number: docNumber.trim() || null, document_type: docType, status,
        total: totalVal, subtotal: baseAmount, tax_rate: rate, tax_amount: taxAmount,
        issue_date: issueDate || null, due_date: dueDate || null, folder_id: folderId,
        notes: notes.trim() || null, file_url: fileUrl, file_name: fileName, file_size: fileSize, file_type: fileType,
      });
      if (insertErr) throw insertErr;

      setSaving(false);
      Alert.alert(t("subir.successTitle"), t("subir.successMsg", { name: docNumber || "Documento" }), [
        { text: t("subir.viewLibrary"), onPress: () => router.replace("/(app)/biblioteca") },
        { text: t("subir.uploadAnother"), onPress: () => { setStep(1); setPickedFile(null); setDocNumber(""); setAmount(""); setCompanyId(null); setNotes(""); setTaxable(""); setVatRate("21"); setIssueDate(""); setDueDate(""); setFolderId(null); } },
      ]);
    } catch (err: any) {
      setSaving(false);
      Alert.alert(t("common.error"), err?.message ?? t("subir.errorArchive"));
    }
  };

  const selectedCompanyName = companies.find((c) => c.id === companyId)?.name ?? "";

  // ── Guard: warn before leaving a half-filled upload ────────────────────────
  const isDirty =
    !!pickedFile || !!companyId ||
    [docNumber, amount, taxable, issueDate, dueDate, notes].some(v => v.trim() !== "");

  const leave = () => router.back();

  const confirmExit = useCallback(() => {
    Alert.alert(t("subir.leaveTitle"), t("subir.leaveBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("subir.leaveConfirm"), style: "destructive", onPress: leave },
    ]);
  }, [t]);

  const handleBack = () => {
    if (step > 1) { setStep(step - 1); return; }
    if (isDirty) { confirmExit(); return; }
    leave();
  };

  // Android hardware back: same behaviour as the header arrow.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (saving) return true;              // don't interrupt an upload in flight
      if (step > 1) { setStep(step - 1); return true; }
      if (isDirty) { confirmExit(); return true; }
      return false;                          // let the OS pop the screen
    });
    return () => sub.remove();
  }, [step, isDirty, saving, confirmExit]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm + 2, paddingBottom: spacing.xs }}>
          <TouchableOpacity onPress={handleBack}>
            <ChevronLeft size={24} color={C.blue} strokeWidth={1.75} />
          </TouchableOpacity>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.text }}>{t("subir.title")}</Text>
        </View>

        {!quotaOk && (
          // The theme has no dedicated warning-tint border, so the yellow accent
          // itself (not a one-off hex) draws the outline.
          <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.sm + 2, flexDirection: "row", gap: spacing.sm + 2, alignItems: "flex-start", backgroundColor: C.yellowL, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: C.yellow }}>
            <AlertTriangle size={18} color={C.yellow} strokeWidth={1.75} style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: C.yellow, flex: 1, lineHeight: 18 }}>{quotaMsg}</Text>
          </View>
        )}

        {quotaOk ? (
          <>
            <StepIndicator current={step} C={C} t={t} />
            {step === 1 && <ScrollView keyboardShouldPersistTaps="handled"><Step1 onNext={() => setStep(2)} pickedFile={pickedFile} setPickedFile={setPickedFile} C={C} t={t} /></ScrollView>}
            {step === 2 && <Step2 onNext={() => setStep(3)} onBack={() => setStep(1)} pickedFile={pickedFile} docType={docType} setDocType={setDocType} docNumber={docNumber} setDocNumber={setDocNumber} companies={companies} companyId={companyId} setCompanyId={setCompanyId} onCreateCompany={handleCreateCompany} creatingCompany={creatingCompany} amount={amount} setAmount={setAmount} taxable={taxable} setTaxable={setTaxable} vatRate={vatRate} setVatRate={setVatRate} issueDate={issueDate} setIssueDate={setIssueDate} dueDate={dueDate} setDueDate={setDueDate} status={status} setStatus={setStatus} notes={notes} setNotes={setNotes} folders={folders} folderId={folderId} setFolderId={setFolderId} foldersLoading={foldersLoading} C={C} t={t} />}
            {step === 3 && <ScrollView keyboardShouldPersistTaps="handled"><Step3 onSubmit={handleSubmit} onBack={() => setStep(2)} saving={saving} pickedFile={pickedFile} docType={docType} docNumber={docNumber} companyName={selectedCompanyName} amount={amount} issueDate={issueDate} dueDate={dueDate} status={status} notes={notes} C={C} t={t} /></ScrollView>}
          </>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.lg }}>
            <AlertTriangle size={56} color={C.yellow} strokeWidth={1.75} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: C.text, textAlign: "center" }}>{t("subir.quotaEmpty")}</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 }}>{quotaMsg}</Text>
            <Button label={t("subir.goBack")} onPress={() => router.back()} size="md" fullWidth={false} />
          </View>
        )}
      </KeyboardAvoidingView>

      <Coachmark
        id="subir-first-doc"
        active={quotaOk}
        icon={<Upload size={32} color={C.blue} strokeWidth={1.75} />}
        title={t("coachmarks.subirFirst.title")}
        description={t("coachmarks.subirFirst.description")}
      />
    </SafeAreaView>
  );
}

export default function SubirScreen() {
  return (
    <RequirePermission section="subir">
      <SubirScreenContent />
    </RequirePermission>
  );
}
