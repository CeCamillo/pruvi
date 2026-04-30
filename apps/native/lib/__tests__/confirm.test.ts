import { afterEach, describe, expect, it, mock } from "bun:test";

// Mock react-native before importing the module under test
const mockAlert = mock((_title: string, _message?: string, _buttons?: any[]) => {});
mock.module("react-native", () => ({
  Alert: { alert: mockAlert },
}));

// Dynamic import after mock is registered
const { confirmDestructiveAction } = await import("../ui/confirm");

afterEach(() => {
  mockAlert.mockReset();
});

function spyAlert(buttonToTap: "Cancel" | "Confirm") {
  const calls: Array<{ title: string; message?: string }> = [];
  mockAlert.mockImplementation((title: string, message?: string, buttons?: any[]) => {
    calls.push({ title, message });
    const target = buttons?.find((b) =>
      buttonToTap === "Confirm" ? b.style === "destructive" : b.style === "cancel"
    );
    target?.onPress?.();
  });
  return calls;
}

describe("confirmDestructiveAction", () => {
  it("resolves true when destructive button is tapped", async () => {
    spyAlert("Confirm");
    await expect(confirmDestructiveAction("Sair?")).resolves.toBe(true);
  });

  it("resolves false when cancel button is tapped", async () => {
    spyAlert("Cancel");
    await expect(confirmDestructiveAction("Sair?")).resolves.toBe(false);
  });

  it("passes title and optional message to Alert.alert", async () => {
    const calls = spyAlert("Cancel");
    await confirmDestructiveAction("Excluir conta?", "Esta ação é permanente.");
    expect(calls[0]).toEqual({ title: "Excluir conta?", message: "Esta ação é permanente." });
  });
});
