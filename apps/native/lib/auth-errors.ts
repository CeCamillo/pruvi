const FALLBACK = "Algo deu errado. Tente novamente.";

const CODE_MAP = {
  INVALID_EMAIL_OR_PASSWORD: "Email ou senha incorretos.",
  USER_ALREADY_EXISTS: "Já existe uma conta com esse email.",
  PASSWORD_TOO_SHORT: "Senha muito curta. Use ao menos 8 caracteres.",
  EMAIL_NOT_VERIFIED: "Confirme seu email antes de entrar.",
  USER_NOT_FOUND: "Não encontramos uma conta com esse email.",
  TOO_MANY_REQUESTS: "Muitas tentativas. Aguarde um instante e tente de novo.",
} as const satisfies Record<string, string>;

function readString(obj: object, key: string): string | null {
  if (!(key in obj)) return null;
  const val = (obj as Record<string, unknown>)[key];
  return typeof val === "string" && val.length > 0 ? val : null;
}

export function getAuthErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return FALLBACK;

  const code = readString(error, "code");
  if (code && code in CODE_MAP) return CODE_MAP[code as keyof typeof CODE_MAP];

  const message = readString(error, "message");
  if (message) return message;

  return FALLBACK;
}
