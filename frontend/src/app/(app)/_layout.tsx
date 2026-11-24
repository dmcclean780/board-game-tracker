import { Slot, usePathname } from "expo-router";
import { View } from "react-native";
import { useTheme } from "../../theme";
import { Footer, Header, SECTIONS, inSection } from "../../components/shell";

const TITLES: Record<string, string> = { "/results": "Results", "/games": "Games", "/groups": "Groups", "/sessions/new": "Record session" };

/** Header and footer around every screen a signed-in User sees; sub-screens get a back arrow and no footer. */
export default function AppLayout() {
  const path = usePathname();
  const { c } = useTheme();
  const section = SECTIONS.some((x) => inSection(path, x));
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={path.startsWith("/settings") ? "Settings" : TITLES[path] ?? "Session"} back={!section} />
      <View style={{ flex: 1, backgroundColor: c.bg }}><Slot /></View>
      {section && <Footer />}
    </View>
  );
}
