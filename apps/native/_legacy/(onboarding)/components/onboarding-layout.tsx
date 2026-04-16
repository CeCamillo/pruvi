import { type PropsWithChildren, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  progressBar: ReactNode;
  bottomSection: ReactNode;
};

export function OnboardingLayout({
  progressBar,
  bottomSection,
  children,
}: PropsWithChildren<Props>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.container}>
        {progressBar}
        {children}
        <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
          {bottomSection}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#FAFBFC",
  },
  bottomSection: {
    marginTop: "auto",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 33,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.03,
    shadowRadius: 40,
    elevation: 4,
  },
});
