import { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, ActivityIndicator,
  Linking, Alert, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  ChevronLeft, MoreVertical, Download, Pencil, Trash2,
  FileText, Link as LinkIcon,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";

const C = {
  blue: "#2563EB", blueL: "#EFF6FF",
  green: "#16A34A", greenL: "#F0FDF4",
  yellow: "#D97706", yellowL: "#FFFBEB",
  red: "#DC2626", redL: "#FEF2F2",
  bg: "#F9FAFB", surface: "#FFFFFF",
  text: "#111827", muted: "#6B7280", border: "#E5E7EB",
};

const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  paid:      { label: "Pagado",    bg: "#F0FDF4", color: "#16A34A" },
  pending:   { label: "Pendiente", bg: "#FFFBEB", color: "#D97706" },
  overdue:   { label: "Vencido",   bg: "#FEF2F2", color: "#DC2626" },
  draft:     { label: "Borrador",  bg: "#F3F4F6", color: "#6B7280" },
  cancelled: { label: "Cancelado", bg: "#F3F4F6", color: "#6B7280" },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice_issued:   "Factura emitida",
  invoice_received: "Factura recibida",
  delivery_note:    "Albarán",
  order:            "Pedido",
  receipt:          "Recibo",
  payroll:          "Nómina",
  contract:         "Contrato",
  quote:            "Presupuesto",
  tax:              "Doc. fiscal",
  other:            "Otro",
};

function Field({ label, value }: { label: string; value: string | null | undefined }) {
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
    Alert.alert("Eliminar documento", "¿Estás seguro? Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive",
        onPress: async () => {
          await supabase.from("documents").delete().eq("id", id);
          router.back();
        },
      },
    ]);
  };

  const handleDownload = async () => {
    if (doc?.file_url) await Linking.openURL(doc.file_url);
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
        <Text style={{ fontSize: 16, fontWeight: "600", color: C.text }}>Documento no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: C.blue }}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sm = STATUS[doc.status] ?? STATUS.draft;
  const fmt = (n: number | null) =>
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
        <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: C.text }}>Detalle</Text>
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
            backgroundColor: "#F1F5F9", borderRadius: 14, borderWidth: 1, borderColor: C.border,
            alignItems: "center", justifyContent: "center", gap: 8,
          }}
          disabled={!doc.file_url}
        >
          <FileText size={48} color="#94A3B8" />
          <Text style={{ fontSize: 12, color: C.muted }}>
            {doc.file_url ? "Toca para abrir el archivo" : "Sin archivo adjunto"}
          </Text>
        </TouchableOpacity>

        {/* Amount + status */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 13, color: C.muted, fontFamily: "monospace" }}>{doc.document_number}</Text>
            <Text style={{ fontSize: 24, fontWeight: "800", color: C.text }}>{fmt(doc.amount)}</Text>
          </View>
          <View style={{ backgroundColor: sm.bg, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: sm.color }}>{sm.label}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 16 }}>
          {[
            { icon: <Download size={18} color={C.blue} />, label: "Descargar", onPress: handleDownload, disabled: !doc.file_url },
            { icon: <Pencil  size={18} color={C.blue} />, label: "Editar",     onPress: () => router.push(`/(app)/editar/${id}`) },
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
            Información
          </Text>
          <Field label="Tipo" value={DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type} />
          <Field label="Empresa" value={doc.companies?.name} />
          <Field label="CIF proveedor" value={doc.companies?.cif} />
          <Field label="Fecha emisión" value={fmtDate(doc.issue_date)} />
          <Field label="Fecha vencimiento" value={fmtDate(doc.due_date)} />
          <Field label="Fecha pago" value={fmtDate(doc.payment_date)} />
          <Field label="Base imponible" value={doc.taxable_base != null ? fmt(doc.taxable_base) : null} />
          <Field label={`IVA (${doc.vat_rate ?? 0}%)`} value={
            doc.taxable_base != null && doc.vat_rate != null
              ? fmt(doc.taxable_base * doc.vat_rate / 100)
              : null
          } />
          <Field label="Total" value={fmt(doc.amount)} />
          <Field label="Notas" value={doc.notes} />
          <Field label="Descripción" value={doc.description} />
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
