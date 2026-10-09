import type { ResumeData } from "../schemas";

// Hand-built dataset for selection tests, independent of the real data/*.json content.
export const fixtureResume: ResumeData = {
  profile: {
    name: "Test Person",
    title: "Senior Full-Stack Engineer",
    yearsExperience: 8,
    location: "Remote",
    summary: "Builds things.",
    greeting: "Hi, I'm Test. Ask me anything!",
    links: [{ label: "GitHub", url: "https://github.com/test" }],
  },
  experience: [
    {
      company: "Acme",
      role: "Senior Engineer",
      start: "2021-03",
      end: "present",
      summary: "Led platform work.",
      stack: ["TypeScript", "Postgres"],
      highlights: ["Shipped billing v2"],
    },
  ],
  skills: {
    groups: [
      { name: "Frontend", items: [{ name: "React", level: "expert", years: 7 }] },
    ],
    favorites: ["TypeScript"],
  },
  projects: [
    {
      id: "billing-v2",
      name: "Billing v2",
      summary: "Rebuilt billing.",
      problem: "Legacy billing was brittle.",
      role: "Tech lead",
      stack: ["Next.js", "Stripe"],
      outcome: "Cut failed charges 40%.",
    },
  ],
  stories: [
    story("s-conflict", ["conflict", "communication"]),
    story("s-lead-conflict", ["leadership", "conflict"]),
    story("s-failure", ["failure"]),
    story("s-lead", ["leadership", "mentoring"]),
  ],
  personal: {
    hobbies: [{ name: "Climbing", detail: "Bouldering twice a week." }],
    interests: ["Coffee"],
    funFacts: ["Has a cat."],
    values: ["Ownership"],
    workingStyle: ["Async-first"],
    voice: { tone: "Friendly and direct", sample: "Honestly? I love a good migration." },
  },
  faq: [
    {
      id: "salary",
      topic: "Compensation",
      triggers: ["salary", "compensation"],
      answer: "Happy to discuss that directly.",
    },
  ],
};

function story(id: string, tags: string[]): ResumeData["stories"][number] {
  return {
    id,
    title: id,
    tags,
    questionPatterns: ["Tell me about a time..."],
    situation: "S",
    task: "T",
    action: "A",
    result: "R",
  };
}
