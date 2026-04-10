import { useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40" fill="none">
      <Rect width={40} height={40} rx={16} fill="white" />
      <Rect x={0.5} y={0.5} width={39} height={39} rx={15.5} stroke="#EFECEC" strokeOpacity={0.5} />
      <Path d="M23 12L17 19L23 26" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SearchInputIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
      <Path
        d="M9.167 15.833a6.667 6.667 0 100-13.333 6.667 6.667 0 000 13.333zM17.5 17.5l-3.625-3.625"
        stroke="#BDBDBD"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PersonAddIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
      <Path
        d="M13.333 17.5v-1.667a3.333 3.333 0 00-3.333-3.333H5a3.333 3.333 0 00-3.333 3.333V17.5M7.5 9.167a3.333 3.333 0 100-6.667 3.333 3.333 0 000 6.667zM16.667 6.667v5M14.167 9.167h5"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Types & Data ────────────────────────────────────────────────────────────

type Friend = {
  id: string;
  name: string;
  username: string;
  initial: string;
  color: string;
};

const SUGGESTIONS: Friend[] = [
  { id: "1", name: "Guilherme Kauark", username: "@guilhermek963462", initial: "G", color: "#F59E0B" },
  { id: "2", name: "Beatriz Oliveira", username: "@bia_vestmed", initial: "B", color: "#EC4899" },
  { id: "3", name: "Ricardo Santos", username: "@ric_enem24", initial: "R", color: "#EF4444" },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProcurarAmigosScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [search, setSearch] = useState("");

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [pressed && { opacity: 0.7 }]}
          >
            <BackIcon />
          </Pressable>
          <Text style={styles.headerTitle}>Procurar amigos</Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      {/* Search input */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrapper}>
          <SearchInputIcon />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="NOME OU NOME DE USUÁRIO"
            placeholderTextColor="#BDBDBD"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Suggestions */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Sugestões de amigos</Text>

        {SUGGESTIONS.map((friend) => (
          <View key={friend.id} style={styles.friendCard}>
            {/* Avatar */}
            <View style={[styles.avatar, { backgroundColor: friend.color }]}>
              <Text style={styles.avatarInitial}>{friend.initial}</Text>
            </View>

            {/* Info */}
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{friend.name}</Text>
              <Text style={styles.friendUsername}>{friend.username}</Text>
            </View>

            {/* Add button */}
            <Pressable
              style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.8 }]}
            >
              <PersonAddIcon />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.45,
    color: "#2B2B2B",
  },

  searchSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#EFECEC",
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.5,
    color: "#2B2B2B",
  },

  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#6B6B6B",
    marginBottom: 16,
    textTransform: "uppercase",
  },

  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(239, 236, 236, 0.3)",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontWeight: "900",
    fontSize: 18,
    color: "#FFFFFF",
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.38,
    color: "#2B2B2B",
  },
  friendUsername: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },
});
