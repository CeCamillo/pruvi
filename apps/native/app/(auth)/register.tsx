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

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(8, "Use at least 8 characters"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const { toast } = useToast();

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
    const result = await authService.register(
      data.name.trim(),
      data.email.trim(),
      data.password,
    );

    if (result.error) {
      toast.show({
        variant: "danger",
        label: result.error.message || "Failed to sign up",
      });
    } else {
      reset();
      toast.show({ variant: "success", label: "Account created successfully" });
    }
  };

  return (
    <Screen>
      <View className="flex-1 justify-center">
        <Surface variant="secondary" className="p-4 rounded-lg">
          <Text className="text-foreground font-medium mb-4">Create Account</Text>

          <View className="gap-3">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.name}>
                  <Label>Name</Label>
                  <Input
                    value={value}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    placeholder="John Doe"
                    autoComplete="name"
                    textContentType="name"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => emailRef.current?.focus()}
                  />
                  <FieldError>{errors.name?.message}</FieldError>
                </TextField>
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField isInvalid={!!errors.email}>
                  <Label>Email</Label>
                  <Input
                    ref={emailRef}
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
                    autoComplete="new-password"
                    textContentType="newPassword"
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
                <Button.Label>Create Account</Button.Label>
              )}
            </Button>
          </View>

          <Link href="/(auth)/login" asChild>
            <Text className="text-primary text-center mt-4">
              Already have an account? Sign In
            </Text>
          </Link>
        </Surface>
      </View>
    </Screen>
  );
}
