import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { useAuth } from "@/context/auth-context";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    const error = await signIn(data.email, data.password);
    if (!error) router.replace("/(app)/dashboard");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-foreground mb-2">
          Bienvenido
        </Text>
        <Text className="text-muted-foreground mb-8">
          Inicia sesión en tu cuenta
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <View className="mb-4">
              <Text className="text-sm font-medium text-foreground mb-1.5">
                Email
              </Text>
              <TextInput
                className="border border-input rounded-lg px-4 py-3 text-foreground bg-background"
                placeholder="tu@email.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={onChange}
                value={value}
              />
              {errors.email && (
                <Text className="text-destructive text-sm mt-1">
                  {errors.email.message}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <View className="mb-6">
              <Text className="text-sm font-medium text-foreground mb-1.5">
                Contraseña
              </Text>
              <TextInput
                className="border border-input rounded-lg px-4 py-3 text-foreground bg-background"
                placeholder="••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                onChangeText={onChange}
                value={value}
              />
              {errors.password && (
                <Text className="text-destructive text-sm mt-1">
                  {errors.password.message}
                </Text>
              )}
            </View>
          )}
        />

        <TouchableOpacity
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-primary rounded-lg py-3 items-center"
        >
          <Text className="text-primary-foreground font-semibold text-base">
            {isSubmitting ? "Iniciando..." : "Iniciar sesión"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-4 items-center"
          onPress={() => router.push("/(auth)/register")}
        >
          <Text className="text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Text className="text-primary font-medium">Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
