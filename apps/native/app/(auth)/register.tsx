import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { z } from "zod";

import { authService } from "@/services/auth.service";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe seu nome")
    .min(2, "Nome muito curto"),
  email: z
    .string()
    .trim()
    .min(1, "Informe seu email")
    .email("Email inválido"),
  password: z
    .string()
    .min(1, "Informe uma senha")
    .min(8, "Use ao menos 8 caracteres"),
});

type RegisterForm = z.infer<typeof registerSchema>;

// ─── Icons ───────────────────────────────────────────────────────────────────

function PruviLogo() {
  return (
    <View style={styles.logoIcon}>
      <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 2L4 6.5V11c0 5.25 3.4 10.15 8 11.5 4.6-1.35 8-6.25 8-11.5V6.5L12 2z"
          fill="#58CD04"
        />
        <Path
          d="M10 12l2 2 4-4"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
        stroke="#6B6B6B"
        strokeWidth={1.5}
      />
      <Path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="#6B6B6B"
        strokeWidth={1.5}
      />
    </Svg>
  ) : (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24M1 1l22 22"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function MailIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={2} y={4} width={20} height={16} rx={2} stroke="#6B6B6B" strokeWidth={1.5} />
      <Path d="M2 7l10 6 10-6" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

function LockIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={11} width={16} height={10} rx={2} stroke="#6B6B6B" strokeWidth={1.5} />
      <Path d="M8 11V7a4 4 0 018 0v4" stroke="#6B6B6B" strokeWidth={1.5} />
    </Svg>
  );
}

function UserIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        d="M12 11a4 4 0 100-8 4 4 0 000 8z"
        stroke="#6B6B6B"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = async (data: RegisterForm) => {
    setFormError(null);
    const result = await authService.register(
      data.name.trim(),
      data.email.trim(),
      data.password,
    );
    if (result.error) {
      setFormError(getAuthErrorMessage(result.error));
    } else {
      reset();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <PruviLogo />
          <Text style={styles.brand}>Pruvi</Text>
          <Text style={styles.title}>Criar sua conta</Text>
          <Text style={styles.subtitle}>
            Comece sua trilha em 30 segundos.
          </Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Nome</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.name && styles.inputWrapError,
                  ]}
                >
                  <UserIcon />
                  <TextInput
                    style={styles.input}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Como podemos te chamar?"
                    placeholderTextColor="#9CA3AF"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                </View>
                {errors.name && (
                  <Text style={styles.fieldError}>{errors.name.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.email && styles.inputWrapError,
                  ]}
                >
                  <MailIcon />
                  <TextInput
                    ref={emailRef}
                    style={styles.input}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="voce@exemplo.com"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </View>
                {errors.email && (
                  <Text style={styles.fieldError}>{errors.email.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Senha</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errors.password && styles.inputWrapError,
                  ]}
                >
                  <LockIcon />
                  <TextInput
                    ref={passwordRef}
                    style={styles.input}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="Ao menos 8 caracteres"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                  <Pressable
                    onPress={() => setShowPassword((p) => !p)}
                    hitSlop={8}
                  >
                    <EyeIcon open={showPassword} />
                  </Pressable>
                </View>
                {errors.password && (
                  <Text style={styles.fieldError}>
                    {errors.password.message}
                  </Text>
                )}
              </View>
            )}
          />

          {formError && (
            <View style={styles.formErrorBox}>
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              isSubmitting && styles.submitBtnDisabled,
              pressed && !isSubmitting && { opacity: 0.9 },
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? "CRIANDO CONTA..." : "CRIAR CONTA"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.footerText}>Já tem uma conta?</Text>
        <Link href="/(auth)/login" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.footerLink}>Entrar</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: "center",
  },
  header: { alignItems: "center", gap: 6, marginBottom: 40 },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
    marginBottom: 12,
  },
  brand: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  title: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
    color: "#2B2B2B",
    marginTop: 10,
    textAlign: "center",
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 20,
    color: "#6B6B6B",
    textAlign: "center",
    marginTop: 4,
  },
  form: { gap: 14 },
  field: { gap: 6 },
  fieldLabel: {
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(240, 240, 240, 0.5)",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.8)",
    paddingHorizontal: 16,
    height: 56,
  },
  inputWrapError: {
    borderColor: "#EF4444",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#2B2B2B",
  },
  fieldError: {
    fontWeight: "700",
    fontSize: 11,
    color: "#EF4444",
    marginLeft: 4,
  },
  formErrorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  formErrorText: {
    fontWeight: "700",
    fontSize: 13,
    color: "#EF4444",
    textAlign: "center",
  },
  submitBtn: {
    marginTop: 12,
    height: 56,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(88, 205, 4, 0.3)",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: "#B8E890",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  footer: {
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    fontWeight: "700",
    fontSize: 13,
    color: "#6B6B6B",
  },
  footerLink: {
    fontWeight: "900",
    fontSize: 13,
    color: "#58CD04",
  },
});
