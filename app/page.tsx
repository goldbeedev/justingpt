import { Chat } from "@/components/Chat";
import { loadResumeData } from "@/lib/data/load";

export default function Home() {
  const { name, greeting } = loadResumeData().profile;
  return <Chat name={name} greeting={greeting} />;
}
