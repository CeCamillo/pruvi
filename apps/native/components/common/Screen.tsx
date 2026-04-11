import { cn } from "heroui-native";
import { type PropsWithChildren } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  padded?: boolean;
  className?: string;
  scrollViewProps?: Omit<ScrollViewProps, "contentContainerStyle">;
}

export function Screen({
  children,
  scrollable = true,
  padded = true,
  className,
  scrollViewProps,
}: PropsWithChildren<ScreenProps>) {
  return (
    <SafeAreaView className={cn("flex-1 bg-background", className)}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          {...scrollViewProps}
        >
          <View className={cn("flex-1", padded && "px-4")}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className={cn("flex-1", padded && "px-4")}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
