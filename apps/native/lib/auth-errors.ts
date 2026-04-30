const FALLBACK = "Algo deu errado. Tente novamente.";

const CODE_MAP: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com esse email.",
  PASSWORD_TOO_SHORT: "Senha muito curta. Use ao menos 8 caracteres.",
  EMAIL_NOT_VERIFIED: "Confirme seu email antes de entrar.",
  USER_NOT_FOUND: "Não encontramos uma conta com esse email.",
  TOO_MANY_REQUESTS: "Muitas tentativas. Aguarde um instante e tente de novo.",
};

export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return FALLBACK;

  const code = "code" in error && typeof (error as Record<string, unknown>).code === "string"
    ? (error as Record<string, unknown>).code as string
    : null;
  if (code && CODE_MAP[code]) return CODE_MAP[code];

  const message = "message" in error && typeof (error as Record<string, unknown>).message === "string"
    ? (error as Record<string, unknown>).message as string
    : null;
  if (message && message.length > 0) return message;

  return FALLBACK;
}
