import { Alert } from "react-native";

export function confirmDestructiveAction(
  title: string,
  message?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirmar", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}
