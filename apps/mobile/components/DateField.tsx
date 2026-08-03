import { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Calendar, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";

/** ISO (YYYY-MM-DD) is what every API and the database expect. */
function toISO(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parses an ISO date without letting the timezone shift the day. */
function fromISO(value?: string | null) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Day-month-year for display; the stored value stays ISO. */
function forDisplay(value?: string | null) {
  const d = fromISO(value);
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Date input backed by the platform's calendar.
 *
 * Typing dates by hand was error-prone and inconsistent (day/month order, wrong
 * separators), so this opens the native picker instead — which also means no
 * keyboard, and therefore nothing to push the surrounding sheet around. The
 * control is styled to match the plain text inputs beside it, so the forms it
 * sits in keep their layout exactly as they were.
 */
export function DateField({
  value, onChange, placeholder, minimumDate, clearable = true, style,
}: {
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  minimumDate?: Date;
  clearable?: boolean;
  style?: object;
}) {
  const C = useColors();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const shown = forDisplay(value);

  const handle = (event: DateTimePickerEvent, picked?: Date) => {
    // Android fires once and dismisses itself; iOS keeps the spinner mounted.
    if (Platform.OS === "android") setOpen(false);
    if (event.type === "dismissed") return;
    if (picked) onChange(toISO(picked));
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        style={[{
          flexDirection: "row", alignItems: "center", gap: 8,
          backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
          borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
        }, style]}
      >
        <Calendar size={15} color={C.muted} />
        <Text style={{ flex: 1, fontSize: 15, color: shown ? C.text : C.muted }}>
          {shown ?? placeholder ?? t("common.selectDate")}
        </Text>
        {clearable && !!shown && (
          <TouchableOpacity onPress={() => onChange(null)} hitSlop={10}>
            <X size={15} color={C.muted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {open && (
        <DateTimePicker
          value={fromISO(value) ?? new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minimumDate}
          onChange={handle}
        />
      )}

      {/* iOS keeps the picker on screen until dismissed explicitly */}
      {open && Platform.OS === "ios" && (
        <TouchableOpacity
          onPress={() => setOpen(false)}
          style={{ alignSelf: "flex-end", paddingVertical: 8, paddingHorizontal: 4 }}
        >
          <Text style={{ color: C.blue, fontWeight: "600", fontSize: 14 }}>{t("common.done")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
