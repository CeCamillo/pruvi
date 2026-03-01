import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { SubjectWithCount } from "@pruvi/shared/subjects";
import { api } from "@/src/services/api";

export default function Dashboard() {
  const router = useRouter();
  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: api.getSubjects,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text className="text-foreground">Carregando...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background pt-12 px-4">
      <Text className="text-2xl font-bold text-foreground mb-6">Matérias</Text>
      <FlashList
        data={subjects}
        numColumns={2}
        estimatedItemSize={120}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <SubjectCard
            subject={item}
            onPress={() => {
              router.push(`/subjects/${String(item.id)}`);
            }}
          />
        )}
      />
    </View>
  );
}

function SubjectCard({ subject, onPress }: { subject: SubjectWithCount; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 m-2 bg-content1 rounded-2xl p-4 min-h-[100px] justify-between"
    >
      <Text className="text-foreground font-semibold text-base" numberOfLines={2}>
        {subject.name}
      </Text>
      <Text className="text-default-400 text-sm mt-2">{subject.questionCount} questões</Text>
    </Pressable>
  );
}
