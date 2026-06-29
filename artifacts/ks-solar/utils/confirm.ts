import { Alert, Platform } from "react-native";

export interface ConfirmOptions {
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText: string;
  destructive: boolean;
}

let _handler: ((opts: ConfirmOptions) => void) | null = null;

export function setConfirmHandler(fn: ((opts: ConfirmOptions) => void) | null) {
  _handler = fn;
}

export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText = "Confirm",
  destructive = false
): void {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: confirmText, style: destructive ? "destructive" : "default", onPress: onConfirm },
    ]);
    return;
  }
  if (_handler) {
    _handler({ title, message, onConfirm, confirmText, destructive });
  } else {
    if (window.confirm(message ? `${title}\n\n${message}` : title)) onConfirm();
  }
}
