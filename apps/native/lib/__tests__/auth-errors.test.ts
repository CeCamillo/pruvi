import { describe, expect, it } from "bun:test";
import { getAuthErrorMessage } from "../auth-errors";

describe("getAuthErrorMessage", () => {
  it("maps INVALID_EMAIL_OR_PASSWORD to Portuguese", () => {
    expect(getAuthErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" }))
      .toBe("Email ou senha incorretos.");
  });

  it("maps USER_ALREADY_EXISTS to Portuguese", () => {
    expect(getAuthErrorMessage({ code: "USER_ALREADY_EXISTS" }))
      .toBe("Já existe uma conta com esse email.");
  });

  it("maps PASSWORD_TOO_SHORT to Portuguese", () => {
    expect(getAuthErrorMessage({ code: "PASSWORD_TOO_SHORT" }))
      .toBe("Senha muito curta. Use ao menos 8 caracteres.");
  });

  it("falls back to a generic message on unknown codes", () => {
    expect(getAuthErrorMessage({ code: "SOMETHING_WEIRD" }))
      .toBe("Algo deu errado. Tente novamente.");
  });

  it("falls back when input is not an object", () => {
    expect(getAuthErrorMessage(null)).toBe("Algo deu errado. Tente novamente.");
    expect(getAuthErrorMessage("string")).toBe("Algo deu errado. Tente novamente.");
    expect(getAuthErrorMessage(undefined)).toBe("Algo deu errado. Tente novamente.");
  });

  it("uses error.message when no known code is present and message exists", () => {
    expect(getAuthErrorMessage({ message: "rede falhou" }))
      .toBe("rede falhou");
  });
});
