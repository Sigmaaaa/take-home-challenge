export type SourceType = "Mixed" | "Email" | "Slack" | "WhatsApp";
export type ContextType = "Formal Email" | "Slack" | "Text";

export interface StyleProfile {
  global: {
    formality: number;
    register: string;
    avg_message_length: string;
    overall_tone: string;
    social_orientation: string;
    politeness_strategy: string;
  };
  mid: {
    sentence_rhythm: string;
    question_frequency: string;
    structural_habits: string[];
    information_structure: string;
    follow_up_behavior: string;
    social_maintenance: string;
    opener_examples: string[];
    opener_pattern: string;
    closer_examples: string[];
    closer_pattern: string;
  };
  local: {
    emoji_usage: string;
    emoji_examples: string[];
    letter_repetition: string[];
    punctuation_stacking: string[];
    filler_phrases: string[];
    hedging: string[];
    intensifiers: string[];
    pronoun_ratio: { I: number; you: number; we: number };
    signoffs: string[];
    signoff_pattern: string;
  };
  cognitive: {
    coarse: string;
    mid: string;
    fine: string;
  };
}

export interface Corpus {
  id: string;
  name: string;
  source_type: SourceType;
  sources: string[];
  source_label: string;
  language: string;
  message_count: number;
  char_count: number;
  date_analyzed: string;
  profile: StyleProfile;
}

export interface GenerationScore {
  overall: number;
  embedding: number;
  programmatic: number;
  llm_judge: number;
  reasoning: string;
}

export interface Generation {
  id: string;
  prompt: string;
  context: ContextType;
  output: string;
  score: GenerationScore;
  date: string;
}

export const mockProfile: StyleProfile = {
  global: {
    formality: 0.42,
    register: "Conversational-casual, shifts to neutral-formal in email",
    avg_message_length: "23 words / 142 chars",
    overall_tone: "Warm, slightly self-deprecating, observant",
    social_orientation: "Other-focused, asks before asserting",
    politeness_strategy: "Negative politeness with hedged directness",
  },
  mid: {
    sentence_rhythm: "Short bursts punctuated by long reflective clauses",
    question_frequency: "1 question per ~4 messages",
    structural_habits: [
      "Lead with context",
      "Soften then ask",
      "Mirror previous phrasing",
      "Defer conclusions",
    ],
    information_structure: "Given-before-new; topic restatement before pivot",
    follow_up_behavior: "Reopens threads with 'btw' or 'one more thing'",
    social_maintenance: "High — checks in unprompted ~2x/week",
    opener_examples: ["hey — quick one", "okay so", "btw", "ok thinking out loud"],
    opener_pattern:
      "Casual single-word or two-word entry, often lowercase, signals low stakes",
    closer_examples: ["lmk what you think", "no rush", "we'll figure it out", "thanks!!"],
    closer_pattern:
      "Releases pressure on the recipient; offers exit; rarely demands a response",
  },
  local: {
    emoji_usage: "Sparing — used as punctuation, not decoration",
    emoji_examples: ["🙏", "😅", "👀", "🫶", "🥲"],
    letter_repetition: ["soooo", "yesss", "ahhh", "noooo"],
    punctuation_stacking: ["!!", "...", "??", "—"],
    filler_phrases: ["kind of", "sort of", "you know", "I mean", "tbh"],
    hedging: ["maybe", "might", "I think", "could be wrong", "if that makes sense"],
    intensifiers: ["really", "actually", "literally", "kind of"],
    pronoun_ratio: { I: 0.34, you: 0.41, we: 0.25 },
    signoffs: ["thanks!!", "appreciate it", "talk soon", "x"],
    signoff_pattern: "Warm but quick, avoids formal corporate sign-offs",
  },
  cognitive: {
    coarse:
      "Other-oriented sense-maker. Treats conversation as joint inquiry rather than information transfer. Will sacrifice clarity for warmth and rarely opens with assertion.",
    mid:
      "Builds arguments through accumulation — small concessions, mirrored phrasing, then a soft pivot. Hedges most strongly right before the actual point, signaling cognitive cost.",
    fine:
      "Lowercase entries, em-dashes as breath marks, double exclamation as a closing release valve. Repeats vowels when emotionally tuned in. Pronouns skew 'you' over 'I' even in self-disclosure.",
  },
};

export const mockCorpus: Corpus = {
  id: "reza-mixed",
  name: "Reza — Mixed Corpus",
  source_type: "Mixed",
  source_label: "Gmail + Slack + WhatsApp export",
  language: "English",
  message_count: 276,
  char_count: 39214,
  date_analyzed: "2026-05-08",
  profile: mockProfile,
};

export const mockGenerations: Generation[] = [
  {
    id: "g1",
    prompt: "Write a follow-up email to a recruiter after a first interview",
    context: "Formal Email",
    output: `Hi Sarah,

Quick note to say thanks again for yesterday — really enjoyed the conversation, especially the part about how the team thinks about onboarding. Gave me a lot to chew on.

I wanted to follow up on the question you asked about ownership scope. Thinking about it more, I'd be excited to take on the integrations side from the start, with the caveat that I'd want to spend the first couple of weeks just listening before proposing anything.

No rush on next steps — happy to share more references or work samples if useful.

Thanks!!
Reza`,
    score: {
      overall: 0.831,
      embedding: 0.86,
      programmatic: 0.79,
      llm_judge: 0.84,
      reasoning:
        "Strong match on opener softness ('Quick note...'), characteristic 'no rush' release, and the signature double-exclamation sign-off. Slightly more structured than baseline conversational, which fits the formal-email register shift.",
    },
    date: "2026-05-09",
  },
  {
    id: "g2",
    prompt: "Slack message asking the team to delay a launch by a week",
    context: "Slack",
    output: `hey team — kind of thinking out loud here

soooo i've been looking at the integration tests this morning and i think we might be cutting it close for friday. nothing is on fire, just... the edge cases around webhook retries are noisier than i expected.

would it be wild to push to next thursday? would give us a real buffer and i'd feel a lot better shipping it. lmk what you think 🙏`,
    score: {
      overall: 0.665,
      embedding: 0.71,
      programmatic: 0.62,
      llm_judge: 0.67,
      reasoning:
        "Captures the lowercase entry, hedging stack ('kind of', 'I think', 'might'), and prosodic compensation ('soooo'). Slightly under-uses the em-dash as breath marker; emoji placement is on-pattern.",
    },
    date: "2026-05-09",
  },
  {
    id: "g3",
    prompt: "Text a friend to cancel dinner tonight",
    context: "Text",
    output: `ahhh i'm so sorry — today completely got away from me and i'm running on fumes

can we push to thursday or friday?? i'll come to you, my treat 🥲`,
    score: {
      overall: 0.615,
      embedding: 0.64,
      programmatic: 0.58,
      llm_judge: 0.63,
      reasoning:
        "Good prosodic match ('ahhh', '??') and apology-first structure. Slightly more declarative than typical — usually opens with a hedge before the apology lands.",
    },
    date: "2026-05-08",
  },
];

export const mockHistory: Generation[] = [
  ...mockGenerations,
  {
    id: "g4",
    prompt: "Reply to a cold sales email politely declining",
    context: "Formal Email",
    output: `Hi Marcus — appreciate the note, and the product looks genuinely interesting.

Not the right moment for us on this one, but I'd love to keep the door open for later in the year. Will drop you a line if anything shifts on our side.

Thanks!!
Reza`,
    score: { overall: 0.78, embedding: 0.81, programmatic: 0.74, llm_judge: 0.79, reasoning: "Solid politeness-strategy match; opener and closer on-pattern." },
    date: "2026-05-07",
  },
  {
    id: "g5",
    prompt: "Slack DM asking a colleague for honest feedback on a draft",
    context: "Slack",
    output: `hey — when you have a sec, mind giving this a read? no rush at all

mostly want to know if the second section actually lands or if i'm in my own head about it 😅`,
    score: { overall: 0.54, embedding: 0.58, programmatic: 0.51, llm_judge: 0.53, reasoning: "Hedging and self-deprecation match; missing the characteristic 'btw' or em-dash breath." },
    date: "2026-05-06",
  },
];
