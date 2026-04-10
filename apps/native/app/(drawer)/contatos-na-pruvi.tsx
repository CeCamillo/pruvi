import { useState } from "react";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
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

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M9.167 15.833a6.667 6.667 0 100-13.333 6.667 6.667 0 000 13.333zM17.5 17.5l-3.625-3.625"
        stroke="#6B6B6B"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircle() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <SvgCircle cx={14} cy={14} r={14} fill="#58CD04" />
      <Path d="M8 14l4 4 8-8" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EmptyCircle() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
      <SvgCircle cx={14} cy={14} r={13} stroke="#EFECEC" strokeWidth={2} />
    </Svg>
  );
}

function PeopleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M14.167 17.5v-1.667a3.333 3.333 0 00-3.334-3.333H5.833a3.333 3.333 0 00-3.333 3.333V17.5M8.333 9.167a3.333 3.333 0 100-6.667 3.333 3.333 0 000 6.667zM18.333 17.5v-1.667a3.333 3.333 0 00-2.5-3.225M12.5 2.608a3.333 3.333 0 010 6.459"
        stroke="white"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Types & Data ────────────────────────────────────────────────────────────

type Contact = {
  id: string;
  name: string;
  username: string;
  initial: string;
  color: string;
  online: boolean;
};

const CONTACTS: Contact[] = [
  { id: "1", name: "Julia Mendes", username: "@juliamed", initial: "J", color: "#8B5CF6", online: true },
  { id: "2", name: "Antonio Cruz", username: "@antonioenem", initial: "A", color: "#F59E0B", online: true },
  { id: "3", name: "Pedro Mira", username: "@pedromed", initial: "P", color: "#3B82F6", online: false },
  { id: "4", name: "Mirelly Cruz", username: "@mirellyc", initial: "M", color: "#EC4899", online: false },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ContatosNaPruviScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(["1", "2"]));

  const toggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(CONTACTS.map((c) => c.id)));
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const isSelected = selected.has(item.id);

    return (
      <Pressable
        style={({ pressed }) => [styles.contactCard, pressed && { opacity: 0.8 }]}
        onPress={() => toggleContact(item.id)}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: item.color }]}>
            <Text style={styles.avatarInitial}>{item.initial}</Text>
          </View>
          {item.online && <View style={styles.onlineDot} />}
        </View>

        {/* Info */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactUsername}>{item.username}</Text>
        </View>

        {/* Check */}
        {isSelected ? <CheckCircle /> : <EmptyCircle />}
      </Pressable>
    );
  };

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
          <Text style={styles.headerTitle}>Contatos na Pruvi</Text>
          <Pressable style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.7 }]}>
            <SearchIcon />
          </Pressable>
        </View>
      </View>

      {/* Subheader */}
      <View style={styles.subheader}>
        <Text style={styles.countText}>25 contatos encontrados</Text>
        <Pressable onPress={selectAll}>
          <Text style={styles.selectAllText}>Selecionar tudo</Text>
        </Pressable>
      </View>

      {/* Contact list */}
      <FlatList
        data={CONTACTS}
        renderItem={renderContact}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom sticky */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          onPress={() => router.back()}
        >
          <PeopleIcon />
          <Text style={styles.primaryButtonText}>Adicionar {selected.size} amigos</Text>
        </Pressable>
      </View>
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
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },

  subheader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(239, 236, 236, 0.4)",
  },
  countText: {
    fontWeight: "700",
    fontSize: 13,
    color: "#6B6B6B",
  },
  selectAllText: {
    fontWeight: "900",
    fontSize: 13,
    color: "#58CD04",
  },

  listContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(239, 236, 236, 0.3)",
  },
  avatarContainer: {
    position: "relative",
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
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#58CD04",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.38,
    color: "#2B2B2B",
  },
  contactUsername: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },

  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.03,
    shadowRadius: 40,
    elevation: 4,
  },
  primaryButton: {
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "rgba(88, 205, 4, 0.5)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 27,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
