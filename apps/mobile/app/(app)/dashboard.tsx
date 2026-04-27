import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useInvoices } from "@invoice-saas/lib/hooks/use-invoices";
import { useClients } from "@invoice-saas/lib/hooks/use-clients";

export default function DashboardScreen() {
  const { invoices } = useInvoices();
  const { clients } = useClients();

  const totalRevenue = invoices
    ?.filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.total, 0) ?? 0;

  const pendingCount = invoices?.filter((inv) => inv.status === "pending").length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4">
        <Text className="text-2xl font-bold text-foreground mt-6 mb-6">
          Dashboard
        </Text>

        {/* Stats Grid */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-card border border-border rounded-xl p-4">
            <Text className="text-muted-foreground text-sm">Ingresos</Text>
            <Text className="text-2xl font-bold text-foreground mt-1">
              €{totalRevenue.toLocaleString("es-ES")}
            </Text>
          </View>
          <View className="flex-1 bg-card border border-border rounded-xl p-4">
            <Text className="text-muted-foreground text-sm">Pendientes</Text>
            <Text className="text-2xl font-bold text-foreground mt-1">
              {pendingCount}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3 mb-8">
          <View className="flex-1 bg-card border border-border rounded-xl p-4">
            <Text className="text-muted-foreground text-sm">Facturas</Text>
            <Text className="text-2xl font-bold text-foreground mt-1">
              {invoices?.length ?? 0}
            </Text>
          </View>
          <View className="flex-1 bg-card border border-border rounded-xl p-4">
            <Text className="text-muted-foreground text-sm">Clientes</Text>
            <Text className="text-2xl font-bold text-foreground mt-1">
              {clients?.length ?? 0}
            </Text>
          </View>
        </View>

        {/* Facturas recientes */}
        <Text className="text-lg font-semibold text-foreground mb-3">
          Facturas recientes
        </Text>
        {invoices?.slice(0, 5).map((invoice) => (
          <View
            key={invoice.id}
            className="bg-card border border-border rounded-xl p-4 mb-3"
          >
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="font-medium text-foreground">
                  {invoice.invoice_number}
                </Text>
                <Text className="text-muted-foreground text-sm mt-0.5">
                  {invoice.client_name}
                </Text>
              </View>
              <View className="items-end">
                <Text className="font-semibold text-foreground">
                  €{invoice.total.toLocaleString("es-ES")}
                </Text>
                <View
                  className={`mt-1 px-2 py-0.5 rounded-full ${
                    invoice.status === "paid"
                      ? "bg-green-100"
                      : invoice.status === "pending"
                      ? "bg-yellow-100"
                      : "bg-red-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      invoice.status === "paid"
                        ? "text-green-700"
                        : invoice.status === "pending"
                        ? "text-yellow-700"
                        : "text-red-700"
                    }`}
                  >
                    {invoice.status === "paid"
                      ? "Pagada"
                      : invoice.status === "pending"
                      ? "Pendiente"
                      : "Vencida"}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
