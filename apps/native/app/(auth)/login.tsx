import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  FieldError,
  Input,
  Label,
  Spinner,
  Surface,
  TextField,
  useToast,
} from "heroui-native";
import { useRef } from "react";
import { Text, TextInput, View } from "react-native";
import { Link } from "expo-router";
import { z } from "zod";

import { Screen } from "@/components/common/Screen";
import { authService } from "@/services/auth.service";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(8, "Use at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const passwordRef = useRef<TextInput>(null);
  const { toast } = useToast();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    const result = await authService.login(data.email.trim(), data.password);

    if (result.error) {
      toast.show({
        variant: "danger",
        label: result.error.message || "Failed to sign in",
      });
    } else {
      reset();
      toast.show({ variant: "success", label: "Signed in successfully" });
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Surface variant="secondary" className="p-4 rounded-lg">
          <Text className="text-foreground font-medium mb-4">Sign In</Text>

          <View className="gap-3">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.email}>
                  <Label>Email</Label>
                  <Input
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="email@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                  <FieldError>{errors.email?.message}</FieldError>
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.password}>
                  <Label>Password</Label>
                  <Input
                    ref={passwordRef}
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    secureTextEntry
                    autoComplete="password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit(onSubmit)}
                  />
                  <FieldError>{errors.password?.message}</FieldError>
                </TextField>
              )}
            />

            <Button onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting} className="mt-1">
              {isSubmitting ? (
                <Spinner size="sm" color="default" />
              ) : (
                <Button.Label>Sign In</Button.Label>
              )}
            </Button>
          </View>

          <Link href="/(auth)/register" asChild>
            <Text className="text-primary text-center mt-4">
              Don't have an account? Sign Up
            </Text>
          </Link>
        </Surface>
      </View>
    </Screen>
  );
}
