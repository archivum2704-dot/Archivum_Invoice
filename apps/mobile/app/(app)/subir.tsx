import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { PDFDocument } from "pdf-lib";
import {
  ChevronLeft, Camera, Image as ImageIcon, FileText, Check,
  Upload, X, AlertTriangle,
} from "lucide-react-native";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Coachmark } from "@/components/Coachmark";
import { useTranslation } from "react-i18next";

const C = {
  blue: "#2563EB", blueL: "#EFF6FF", blueMed: "#DBEAFE",
  green: "#16A34A", greenL: "#F0FDF4",
  red: "#DC2626", redL: "#FEF2F2",
  yellow: "#D97706", yellowL: "#FFFBEB",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

const DOC_TYPES = [
  { key: "invoice_received", label: "Factura recibida" },
  { key: "invoice_issued",   label: "Factura emitida" },
  { key: "delivery_note",    label: "Albarán" },
  { key: "order",            label: "Pedido" },
  { key: "receipt",          label: "Recibo" },
  { key: "quote",            label: "Presupuesto" },
  { key: "payroll",          label: "Nómina" },
  { key: "contract",         label: "Contrato" },
  { key: "other",            label: "Otro" },
];

const STATUSES = [
  { key: "draft",   label: "Borrador" },
  { key: "pending", label: "Pendiente" },
  { key: "paid",    label: "Pagado" },
];

interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  converting?: boolean;
}

/* ── Convert any image URI to a PDF using pdf-lib (pure JS, no native) ─── */
async function convertImageToPdf(imageUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });
  const ext = imageUri.split(".").pop()?.toLowerCase() ?? "jpg";
  const isJpeg = ext !== "png";

  const pdfDoc = await PDFDocument.create();
  const img = isJpeg
    ? await pdfDoc.embedJpg(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
    : await pdfDoc.embedPng(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));

  // Scale image to fit A4 (595 x 842 pt) with margins
  const A4_W = 595, A4_H = 842, MARGIN = 24;
  const maxW = A4_W - MARGIN * 2, maxH = A4_H - MARGIN * 2;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = img.width * scale, h = img.height * scale;

  const page = pdfDoc.addPage([A4_W, A4_H]);
  page.drawImage(img, {
    x: (A4_W - w) / 2,
    y: (A4_H - h) / 2,
    width: w,
    height: h,
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

  const outUri = FileSystem.Paths.cache.uri + `doc_${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(outUri, pdfBase64, {
    encoding: 'base64',
  });
  return outUri;
}

/* ── Step indicator ─────────────────────────────────────────────────────── */
function StepIndicator({ current }: { current: number }) {
  const steps = ["Archivo", "Metadatos", "Confirmar"];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 16 }}>
      {steps.map((s, i) => {
        const done   = i + 1 < current;
        const active = i + 1 === current;
        return (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", flex: i < steps.length - 1 ? 1 : 0 }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",
                backgroundColor: done || active ? C.blue : C.surface,
                borderWidth: done || active ? 0 : 2, borderColor: C.border,
              }}>
                {done
                  ? <Check size={14} color="#fff" />
                  : <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : C.muted }}>{i + 1}</Text>
                }
              </View>
              <Text style={{ fontSize: 10, fontWeight: active ? "700" : "400", color: active ? C.blue : C.muted }}>{s}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={{ flex: 1, height: 2, marginBottom: 14, marginHorizontal: 4, backgroundColor: i + 1 < current ? C.blue : C.border }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

/* ── Step 1: File selection ──────────────────────────────────────────────── */
function Step1({
  onNext, pickedFile, setPickedFile,
}: {
  onNext: () => void;
  pickedFile: PickedFile | null;
  setPickedFile: (f: PickedFile | null) => void;
}) {
  const [converting, setConverting] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    try {
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.9 });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setConverting(true);
      try {
        const pdfUri  = await convertImageToPdf(asset.uri);
        const info    = await FileSystem.getInfoAsync(pdfUri);
        const name    = (asset.fileName ?? "imagen").replace(/\.[^.]+$/, "") + ".pdf";
        setPickedFile({ uri: pdfUri, name, size: (info as any).size ?? 0, mimeType: "application/pdf" });
      } catch (err) {
        // Fallback: use original image without conversion
        const info = await FileSystem.getInfoAsync(asset.uri);
        setPickedFile({
          uri: asset.uri,
          name: asset.fileName ?? "imagen.jpg",
          size: (info as any).size ?? 0,
          mimeType: asset.mimeType ?? "image/jpeg",
        });
      } finally {
        setConverting(false);
      }
    } catch {
      Alert.alert("Error", "No se pudo acceder a la cámara o galería.");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      // If image, convert to PDF
      if (asset.mimeType?.startsWith("image/")) {
        setConverting(true);
        try {
          const pdfUri = await convertImageToPdf(asset.uri);
          const info = await FileSystem.getInfoAsync(pdfUri);
          setPickedFile({ uri: pdfUri, name: asset.name.replace(/\.[^.]+$/, "") + ".pdf", size: (info as any).size ?? 0, mimeType: "application/pdf" });
        } catch {
          setPickedFile({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? "application/pdf" });
        } finally {
          setConverting(false);
        }
      } else {
        setPickedFile({ uri: asset.uri, name: asset.name, size: asset.size ?? 0, mimeType: asset.mimeType ?? "application/pdf" });
      }
    } catch {
      Alert.alert("Error", "No se pudo abrir el archivo.");
    }
  };

  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;

  return (
    <View style={{ padding: 16, gap: 16 }}>
      {/* Drop zone */}
      <TouchableOpacity
        onPress={pickDocument}
        style={{
          borderWidth: 2, borderStyle: "dashed", borderColor: C.blue,
          borderRadius: 16, padding: 32, alignItems: "center", gap: 12,
          backgroundColor: C.blueL,
        }}
      >
        {converting ? (
          <>
            <ActivityIndicator size="large" color={C.blue} />
            <Text style={{ fontSize: 13, color: C.blue }}>Convirtiendo a PDF…</Text>
          </>
        ) : pickedFile ? (
          <>
            <View style={{ width: 48, height: 60, backgroundColor: C.blueMed, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
              <FileText size={24} color={C.blue} />
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.blue }} numberOfLines={1}>{pickedFile.name}</Text>
            <Text style={{ fontSize: 12, color: C.muted }}>PDF · {formatSize(pickedFile.size)}</Text>
            <TouchableOpacity onPress={() => setPickedFile(null)} style={{ position: "absolute", top: 12, right: 12 }}>
              <X size={16} color={C.muted} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Upload size={40} color={C.blue} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: C.blue }}>Toca para seleccionar</Text>
            <Text style={{ fontSize: 12, color: C.muted }}>PDF, JPG, PNG — máx. 25 MB</Text>
            <Text style={{ fontSize: 11, color: C.blue, fontWeight: "500", marginTop: 2 }}>
              Las imágenes se convierten a PDF automáticamente
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Source buttons */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[
          { label: "Cámara",  onPress: () => pickImage(true) },
          { label: "Galería", onPress: () => pickImage(false) },
          { label: "Archivos", onPress: pickDocument },
        ].map(({ label, onPress }) => (
          <TouchableOpacity
            key={label}
            onPress={onPress}
            disabled={converting}
            style={{
              flex: 1, padding: 14, backgroundColor: C.surface,
              borderWidth: 1, borderColor: C.border, borderRadius: 12,
              alignItems: "center", gap: 6, opacity: converting ? 0.5 : 1,
            }}
          >
            {label === "Cámara"   && <Camera   size={22} color={C.blue} />}
            {label === "Galería"  && <ImageIcon size={22} color={C.blue} />}
            {label === "Archivos" && <FileText  size={22} color={C.blue} />}
            <Text style={{ fontSize: 12, fontWeight: "500", color: C.text }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        onPress={onNext}
        disabled={converting}
        style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center", opacity: converting ? 0.5 : 1 }}
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Continuar →</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Step 2: Metadata ───────────────────────────────────────────────────── */
function Step2({
  onNext, onBack,
  docType, setDocType, docNumber, setDocNumber,
  companyName, setCompanyName,
  amount, setAmount, taxable, setTaxable, vatRate, setVatRate,
  issueDate, setIssueDate, dueDate, setDueDate,
  status, setStatus, notes, setNotes,
  pickedFile,
}: any) {
  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 14 }}>
        {/* File thumb */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
          backgroundColor: C.surface, borderRadius: 12,
          shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
        }}>
          <View style={{ width: 44, height: 56, backgroundColor: C.blueL, borderRadius: 6, alignItems: "center", justifyContent: "center" }}>
            <FileText size={20} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: C.text }} numberOfLines={1}>
              {pickedFile?.name ?? "Sin archivo"}
            </Text>
            <Text style={{ fontSize: 12, color: C.muted }}>
              PDF · {pickedFile ? formatSize(pickedFile.size) : "—"}
            </Text>
          </View>
        </View>

        {/* Doc type */}
        <View>
          <Text style={styles.label}>Tipo de documento *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {DOC_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.key} onPress={() => setDocType(t.key)}
                  style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: docType === t.key ? C.blue : C.border, backgroundColor: docType === t.key ? C.blue : C.surface }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: docType === t.key ? "#fff" : C.muted }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {[
          { label: "Número de documento *", value: docNumber,    setter: setDocNumber,    ph: "FAC-2025-0001" },
          { label: "Empresa / Cliente *",   value: companyName,  setter: setCompanyName,  ph: "Buscar empresa…" },
          { label: "Fecha de emisión",      value: issueDate,    setter: setIssueDate,    ph: "2025-01-15" },
          { label: "Fecha de vencimiento",  value: dueDate,      setter: setDueDate,      ph: "2025-02-15" },
          { label: "Importe total (€)",     value: amount,       setter: setAmount,       ph: "4280.00", keyboard: "numeric" },
          { label: "Base imponible (€)",    value: taxable,      setter: setTaxable,      ph: "3537.19", keyboard: "numeric" },
          { label: "% IVA",                 value: vatRate,      setter: setVatRate,      ph: "21",      keyboard: "numeric" },
        ].map((f) => (
          <View key={f.label}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={styles.input}
              placeholder={f.ph} placeholderTextColor={C.muted}
              value={f.value} onChangeText={f.setter}
              keyboardType={f.keyboard as any ?? "default"}
            />
          </View>
        ))}

        {/* Status */}
        <View>
          <Text style={styles.label}>Estado</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {STATUSES.map((s) => (
              <TouchableOpacity
                key={s.key} onPress={() => setStatus(s.key)}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: status === s.key ? C.blue : C.border, backgroundColor: status === s.key ? C.blue : C.surface }}
              >
                <Text style={{ fontSize: 12, fontWeight: "500", color: status === s.key ? "#fff" : C.muted }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text style={styles.label}>Notas</Text>
          <TextInput
            style={[styles.input, { minHeight: 60 }]}
            placeholder="Observaciones, referencias internas…" placeholderTextColor={C.muted}
            value={notes} onChangeText={setNotes} multiline
          />
        </View>

        <TouchableOpacity onPress={onNext} style={{ backgroundColor: C.blue, borderRadius: 10, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Continuar →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 13, alignItems: "center" }}>
          <Text style={{ color: C.muted, fontWeight: "500", fontSize: 15 }}>← Atrás</Text>
        </TouchableOpacity>
        <View style={{ height: 8 }} />
      </View>
    </ScrollView>
  );
}

/* ── Step 3: Confirm ────────────────────────────────────────────────────── */
function Step3({ onSubmit, onBack, saving, pickedFile, docType, docNumber, companyName, amount, issueDate, dueDate, status, notes }: any) {
  const DOC_LABELS: Record<string, string> = {
    invoice_received: "Factura recibida", invoice_issued: "Factura emitida",
    delivery_note: "Albarán", order: "Pedido", receipt: "Recibo",
    quote: "Presupuesto", payroll: "Nómina", contract: "Contrato", other: "Otro",
  };
  const STATUS_LABELS: Record<string, string> = { draft: "Borrador", pending: "Pendiente", paid: "Pagado" };
  const formatSize = (bytes: number) =>
    bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

  const rows = [
    ["Tipo",         DOC_LABELS[docType] ?? docType],
    ["Nº Documento", docNumber || "—"],
    ["Empresa",      companyName || "—"],
    ["Fecha emisión", issueDate || "—"],
    ["Vencimiento",  dueDate || "—"],
    ["Importe",      amount ? `€${parseFloat(amount.replace(",", ".")).toLocaleString("es-ES", { minimumFractionDigits: 2 })}` : "—"],
    ["Estado",       STATUS_LABELS[status] ?? status],
  ];

  return (
    <View style={{ padding: 16, gap: 14 }}>
      <View style={{ backgroundColor: C.surface, borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: C.text, padding: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
          Resumen
        </Text>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", padding: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ fontSize: 13, color: C.muted }}>{k}</Text>
            <Text style={{ fontSize: 13, fontWeight: "500", color: C.text }}>{v}</Text>
          </View>
        ))}
      </View>

      {pickedFile && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.blueL, borderRadius: 12, padding: 12 }}>
          <FileText size={20} color={C.blue} />
          <Text style={{ fontSize: 13, color: C.blue, flex: 1 }} numberOfLines={1}>
            {pickedFile.name} · {formatSize(pickedFile.size)}
          </Text>
        </View>
      )}

      {notes ? (
        <View style={{ backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Notas</Text>
          <Text style={{ fontSize: 13, color: C.text }}>{notes}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        onPress={onSubmit} disabled={saving}
        style={{ backgroundColor: C.green, borderRadius: 10, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}
      >
        {saving
          ? <ActivityIndicator color="#fff" />
          : <><Check size={18} color="#fff" /><Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Archivar documento</Text></>
        }
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingVertical: 13, alignItems: "center" }}>
        <Text style={{ color: C.muted, fontWeight: "500", fontSize: 15 }}>← Editar datos</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Main screen ─────────────────────────────────────────────────────────── */
export default function SubirScreen() {
  const { t } = useTranslation();
  const { orgId } = useAuth();
  const [step, setStep] = useState(1);

  // File
  const [pickedFile, setPickedFile] = useState<PickedFile | null>(null);

  // Subscription gate
  const [quotaOk,  setQuotaOk]  = useState(true);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);

  // Form fields
  const [docType,     setDocType]     = useState("invoice_received");
  const [docNumber,   setDocNumber]   = useState("");
  const [companyName, setCompanyName] = useState("");
  const [amount,      setAmount]      = useState("");
  const [taxable,     setTaxable]     = useState("");
  const [vatRate,     setVatRate]     = useState("21");
  const [issueDate,   setIssueDate]   = useState("");
  const [dueDate,     setDueDate]     = useState("");
  const [status,      setStatus]      = useState("pending");
  const [notes,       setNotes]       = useState("");
  const [saving,      setSaving]      = useState(false);

  // Check quota on mount
  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const { data: org } = await supabase
        .from("organizations")
        .select("doc_quota_pool, subscription_status, current_period_end")
        .eq("id", orgId)
        .single();

      if (!org) return;

      const now       = new Date();
      const periodEnd = org.current_period_end ? new Date(org.current_period_end) : null;
      const isExpired =
        ["canceled", "unpaid"].includes(org.subscription_status ?? "") &&
        periodEnd && now > periodEnd;

      if (isExpired) {
        setQuotaOk(false);
        setQuotaMsg("Tu suscripción ha vencido. Renuévala para poder subir documentos.");
        return;
      }

      if ((org.doc_quota_pool ?? 0) <= 0) {
        setQuotaOk(false);
        setQuotaMsg(
          "Has alcanzado el límite de documentos de tu plan. La cuota se renueva el próximo mes o puedes contratar documentos adicionales."
        );
      }
    })();
  }, [orgId]);

  const handleSubmit = async () => {
    if (!orgId || !quotaOk) return;
    setSaving(true);

    try {
      let fileUrl:  string | null = null;
      let fileName: string | null = null;
      let fileSize: number | null = null;
      let fileType: string | null = null;

      // Upload file to Supabase Storage if one was picked
      if (pickedFile) {
        const storagePath = `${orgId}/${Date.now()}_${pickedFile.name}`;
        const fileContent = await FileSystem.readAsStringAsync(pickedFile.uri, {
          encoding: 'base64',
        });

        // Decode base64 to Uint8Array for Supabase upload
        const binary = atob(fileContent);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const { error: storageErr } = await supabase.storage
          .from("documents")
          .upload(storagePath, bytes, {
            contentType: pickedFile.mimeType,
            upsert: false,
          });

        if (!storageErr) {
          fileUrl  = storagePath;
          fileName = pickedFile.name;
          fileSize = pickedFile.size;
          fileType = pickedFile.mimeType;
        } else {
          console.warn("[subir] Storage upload failed:", storageErr.message);
        }
      }

      // Find company by name
      let companyId: string | null = null;
      if (companyName.trim()) {
        const { data: comp } = await supabase
          .from("companies")
          .select("id")
          .eq("organization_id", orgId)
          .ilike("name", `%${companyName.trim()}%`)
          .limit(1)
          .single();
        companyId = comp?.id ?? null;
      }

      const { error: insertErr } = await supabase.from("documents").insert({
        organization_id: orgId,
        company_id:     companyId,
        document_number: docNumber.trim() || null,
        document_type:  docType,
        status,
        total:           amount  ? parseFloat(amount.replace(",", "."))  : null,
        tax_rate:        vatRate ? parseFloat(vatRate.replace(",", ".")) : null,
        issue_date:      issueDate || null,
        due_date:        dueDate   || null,
        notes:           notes.trim() || null,
        file_url:        fileUrl,
        file_name:       fileName,
        file_size:       fileSize,
        file_type:       fileType,
      });

      if (insertErr) throw insertErr;

      setSaving(false);
      Alert.alert(
        "✓ Documento archivado",
        `${docNumber || "Documento"} archivado correctamente.`,
        [
          { text: "Ver biblioteca", onPress: () => router.replace("/(app)/biblioteca") },
          {
            text: "Subir otro",
            onPress: () => {
              setStep(1); setPickedFile(null);
              setDocNumber(""); setAmount(""); setCompanyName(""); setNotes("");
              setTaxable(""); setVatRate("21"); setIssueDate(""); setDueDate("");
            },
          },
        ]
      );
    } catch (err: any) {
      setSaving(false);
      Alert.alert("Error", err?.message ?? "No se pudo archivar el documento.");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
          <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
            <ChevronLeft size={24} color={C.blue} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "700", color: C.text }}>Archivar documento</Text>
        </View>

        {/* Quota / subscription warning */}
        {!quotaOk && (
          <View style={{ marginHorizontal: 16, marginBottom: 10, flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: C.yellowL, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FDE68A" }}>
            <AlertTriangle size={18} color={C.yellow} style={{ marginTop: 1 }} />
            <Text style={{ fontSize: 13, color: C.yellow, flex: 1, lineHeight: 18 }}>{quotaMsg}</Text>
          </View>
        )}

        {quotaOk ? (
          <>
            <StepIndicator current={step} />

            {step === 1 && (
              <ScrollView>
                <Step1
                  onNext={() => setStep(2)}
                  pickedFile={pickedFile}
                  setPickedFile={setPickedFile}
                />
              </ScrollView>
            )}

            {step === 2 && (
              <Step2
                onNext={() => setStep(3)} onBack={() => setStep(1)}
                pickedFile={pickedFile}
                docType={docType} setDocType={setDocType}
                docNumber={docNumber} setDocNumber={setDocNumber}
                companyName={companyName} setCompanyName={setCompanyName}
                amount={amount} setAmount={setAmount}
                taxable={taxable} setTaxable={setTaxable}
                vatRate={vatRate} setVatRate={setVatRate}
                issueDate={issueDate} setIssueDate={setIssueDate}
                dueDate={dueDate} setDueDate={setDueDate}
                status={status} setStatus={setStatus}
                notes={notes} setNotes={setNotes}
              />
            )}

            {step === 3 && (
              <ScrollView>
                <Step3
                  onSubmit={handleSubmit} onBack={() => setStep(2)} saving={saving}
                  pickedFile={pickedFile}
                  docType={docType} docNumber={docNumber} companyName={companyName}
                  amount={amount} issueDate={issueDate} dueDate={dueDate} status={status} notes={notes}
                />
              </ScrollView>
            )}
          </>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
            <AlertTriangle size={56} color={C.yellow} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: C.text, textAlign: "center" }}>
              Cuota agotada
            </Text>
            <Text style={{ fontSize: 14, color: C.muted, textAlign: "center", lineHeight: 20 }}>
              {quotaMsg}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: C.blue, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 }}
            >
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>Volver</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* First-time hint */}
      <Coachmark
        id="subir-first-doc"
        active={quotaOk}
        icon={<Upload size={32} color={C.blue} />}
        title={t("coachmarks.subirFirst.title")}
        description={t("coachmarks.subirFirst.description")}
      />
    </SafeAreaView>
  );
}

const styles = {
  label: { fontSize: 12, fontWeight: "500" as const, color: "#6B7280", marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: "#111827", backgroundColor: "#FFFFFF",
  },
};
