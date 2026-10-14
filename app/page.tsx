import { Chat } from "@/components/Chat";
import { loadResumeData } from "@/lib/data/load";
import { buildSuggestionPool } from "@/lib/data/suggestions";

export default function Home() {
  const data = loadResumeData();
  const { name, greeting } = data.profile;
  return <Chat name={name} greeting={greeting} suggestions={buildSuggestionPool(data)} />;
}
