import { Stack } from "expo-router";

export default function OnboardingGroupLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
  );
}
