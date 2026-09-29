import { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Store, ChevronDown, ChevronUp, Check, AlertTriangle } from "lucide-react-native";
import { useColors } from "@/lib/colors";
import { fonts } from "@/lib/typography";
import { spacing } from "@/lib/spacing";
import { radius } from "@/lib/radius";
import { principalOptions, type ClientLike } from "@/lib/client-checks";

/**
 * "Establecimiento de…" — files a client under a principal that has the same
 * CIF/NIF (another shop, office or branch of the same taxpayer). Espejo de
 * `apps/web/components/establishment-field.tsx`.
 *
 * An inline, searchable list rather than a sheet: the client forms are
 * already sheets, and a sheet over a sheet misbehaves on iOS.
 */
export function EstablishmentPicker({ existing, selfId, value, onChange, hasEstablishments }: {
  existing: ClientLike[];
  selfId?: string | null;
  value: string;
  onChange: (principal: ClientLike | null) => void;
  hasEstablishments?: boolean;
}) {
  const C = useColors();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const options = useMemo(() => principalOptions(existing, selfId), [existing, selfId]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? options.filter(o => o.name.toLowerCase().includes(s) || (o.cif ?? "").toLowerCase().includes(s)) : options).slice(0, 8);
  }, [options, q]);
  const selected = options.find(o => o.id === value) ?? existing.find(o => o.id === value);

  if (hasEstablishments) {
    return <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted }}>Cliente principal con establecimientos: no puede ser a su vez establecimiento de otro.</Text>;
  }

  const pick = (o: ClientLike | null) => { onChange(o); setOpen(false); setQ(""); };

  return (
    <View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: C.text, marginBottom: 6 }}>Establecimiento de</Text>
      <TouchableOpacity onPress={() => setOpen(o => !o)} disabled={options.length === 0}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 11, opacity: options.length === 0 ? 0.6 : 1 }}>
        <Store size={15} color={C.muted} strokeWidth={1.75} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: selected ? C.text : C.muted }} numberOfLines={1}>
          {selected ? selected.name : "Ninguno — es un cliente principal"}
        </Text>
        {open ? <ChevronUp size={16} color={C.muted} strokeWidth={1.75} /> : <ChevronDown size={16} color={C.muted} strokeWidth={1.75} />}
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: radius.md, backgroundColor: C.surface }}>
          {options.length > 8 && (
            <TextInput value={q} onChangeText={setQ} placeholder="Buscar cliente…" placeholderTextColor={C.muted} autoCorrect={false}
              style={{ fontFamily: fonts.regular, fontSize: 14, color: C.text, paddingHorizontal: spacing.md, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border }} />
          )}
          {[null, ...matches].map(o => {
            const active = (o?.id ?? "") === value;
            return (
              <TouchableOpacity key={o?.id ?? "none"} onPress={() => pick(o)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: C.text }} numberOfLines={1}>
                  {o ? `${o.name}${o.cif ? ` · ${o.cif}` : ""}` : "Ninguno — es un cliente principal"}
                </Text>
                {active && <Check size={16} color={C.blue} strokeWidth={1.75} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: C.muted, marginTop: 4 }}>
        {value
          ? "Otro local o delegación del mismo cliente: mismo CIF/NIF, con su propia dirección."
          : "Para un segundo local o delegación del mismo cliente (mismo CIF/NIF, otra dirección)."}
      </Text>
    </View>
  );
}

/** Blocking notice for a CIF already used by a principal, with the way out. */
export function CifTakenNotice({ message, principal, onMakeEstablishment }: {
  message: string;
  principal: ClientLike;
  onMakeEstablishment: () => void;
}) {
  const C = useColors();
  return (
    <View style={{ backgroundColor: C.redL, borderRadius: radius.md, padding: spacing.sm + 2, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <AlertTriangle size={14} color={C.red} strokeWidth={1.75} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 12, color: C.red }}>{message}</Text>
      </View>
      <TouchableOpacity onPress={onMakeEstablishment}
        style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
        <Store size={14} color={C.text} strokeWidth={1.75} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: C.text }}>Crear como establecimiento de «{principal.name}»</Text>
      </TouchableOpacity>
    </View>
  );
}
