import { cn } from "heroui-native";
import { type ViewProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

interface SkeletonProps extends ViewProps {
  width?: number | string;
  height?: number | string;
  rounded?: boolean;
}

export function Skeleton({
  width,
  height = 16,
  rounded = false,
  className,
  style,
  ...props
}: SkeletonProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.5, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={cn("bg-default-200", rounded && "rounded-full", className)}
      style={[
        {
          width: width as number | undefined,
          height: height as number | undefined,
          borderRadius: rounded ? undefined : 8,
        },
        animatedStyle,
        style,
      ]}
      {...props}
    />
  );
}
