import { useState } from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Calendar, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useColors } from "@/lib/colors";
import { useTheme } from "@/context/theme-context";
import { KeyboardModal } from "@/components/KeyboardModal";

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
  const { isDark } = useTheme();
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

      {/* Android puts up its own floating dialog, so it can render in place. */}
      {open && Platform.OS === "android" && (
        <DateTimePicker
          value={fromISO(value) ?? new Date()}
          mode="date"
          display="default"
          minimumDate={minimumDate}
          onChange={handle}
        />
      )}

      {/* iOS renders the calendar as an ordinary view. Left in the form it
          would push everything below it down and resize the sheet, so it goes
          in its own sheet and the form underneath stays exactly as it was. */}
      {Platform.OS === "ios" && (
        <KeyboardModal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: C.overlay }} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={{ backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 12 }}>
            <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: "center", marginTop: 12 }} />
            <DateTimePicker
              value={fromISO(value) ?? new Date()}
              mode="date"
              display="inline"
              minimumDate={minimumDate}
              onChange={handle}
              themeVariant={isDark ? "dark" : "light"}
              style={{ height: 360 }}
            />
            <TouchableOpacity
              onPress={() => setOpen(false)}
              style={{ marginHorizontal: 20, borderRadius: 12, paddingVertical: 13, alignItems: "center", backgroundColor: C.blue }}
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{t("common.done")}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardModal>
      )}
    </View>
  );
}
