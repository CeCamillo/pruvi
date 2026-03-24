import { Text, View } from "react-native";

import { OnboardingLayout } from "./components/onboarding-layout";
import { ProgressBar } from "./components/progress-bar";

export default function ExamSelectScreen() {
  return (
    <OnboardingLayout
      progressBar={<ProgressBar current={2} total={3} />}
      bottomSection={<View />}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 18, color: "#2B2B2B" }}>Exam Select — TODO</Text>
      </View>
    </OnboardingLayout>
  );
}
