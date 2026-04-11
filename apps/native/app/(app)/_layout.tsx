import { Drawer } from "expo-router/drawer";

export default function AppLayout() {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        swipeEnabled: false,
        drawerItemStyle: { display: "none" },
      }}
    />
  );
}
