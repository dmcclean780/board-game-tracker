import { Slot, usePathname } from "expo-router";
import { View } from "react-native";
import { Footer, Header, SECTIONS } from "../../components/shell";

const TITLES: Record<string, string> = { "/results": "Results", "/games": "Games", "/groups": "Groups", "/account": "Account", "/sessions/new": "Record session" };

/** Header and footer around every screen a signed-in User sees; sub-screens get a back arrow and no footer. */
export default function AppLayout() {
  const path = usePathname();
  const section = SECTIONS.some((x) => x.path === path);
  return (
    <View style={{ flex: 1 }}>
      <Header title={TITLES[path] ?? "Session"} back={!section} />
      <View style={{ flex: 1 }}><Slot /></View>
      {section && <Footer />}
    </View>
  );
}
