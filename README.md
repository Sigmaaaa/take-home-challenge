# Tone & Style Simulator

> Extract someone's psycholinguistic fingerprint from their real writing. Generate new text that authentically matches their voice.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-191919?style=flat&logo=anthropic&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)

**[Live Demo](https://rezapleasehirehim.com)** · **[Colab Notebook](./colab/scorer.ipynb)**

---

## What This Is

Most style transfer tools treat writing style as a bag of surface features: emoji count, sentence length, exclamation marks. This tool treats it as a psycholinguistic fingerprint.

Given a corpus of someone's real writing across contexts (emails, Slack messages, texts), the app extracts a structured style profile grounded in computational psycholinguistics research, then generates new text that authentically matches their voice for any writing context. A three-layer scoring system evaluates how well the output matches the original style, combining neural style embeddings, corpus-derived statistical features, and an LLM judge.

The research directly shapes the engineering. The profile schema is the theoretical model. The scorer is the measurement apparatus. Neither works without the other.

---

## The Spike

### A Psycholinguistically Grounded Cognitive Style Hierarchy

Writing style has structure. It is not a flat list of features but a hierarchy of signals operating at different levels of abstraction, from broad social orientation down to individual punctuation habits.

[Moshe Bar's predictive coding and gist-first perception theory](https://www.nature.com/articles/nrn1476) proposes that the brain processes percepts coarse-to-fine: global structure first, local detail second. The same principle applies to writing style. A reader identifies someone's voice by first detecting their broad register and social orientation, then their discourse habits, then their surface-level quirks. The style profile mirrors this exactly.

```mermaid
flowchart TD
    A["COARSE\nRegister · Social orientation · Politeness strategy"]
    B["MID\nDiscourse structure · Information flow · Sentence rhythm"]
    C["FINE\nProsodic compensation · Emoji patterns · Punctuation habits"]
    A --> B --> C
    style A fill:#6366F1,color:#fff,stroke:none
    style B fill:#4F46E5,color:#fff,stroke:none
    style C fill:#3730A3,color:#fff,stroke:none
```

### Research Grounding

Every dimension in the style profile has a citation behind it.

[Pennebaker's LIWC research](https://www.science.org/doi/10.1126/science.290.5490.248) shows that function word usage, especially pronouns, is one of the most reliable and content-independent style signals available. High you-frequency reliably indicates other-focused communicators regardless of topic. This directly informs the pronoun ratio dimension and social orientation classification.

[Brown and Levinson's politeness theory](https://www.cambridge.org/core/books/politeness/8C4F6ED5E8618A7574049C69DD8B2B03) establishes positive politeness (solidarity, warmth) and negative politeness (deference, face-saving) as genuine psycholinguistic dimensions. Classifying a writer's strategy here is not a vague tone label. It is a theoretically grounded measurement.

[Biber's multi-dimensional register analysis](https://www.cambridge.org/core/books/variation-across-speech-and-writing/BBC85A67C56D03BF4F8B7D4DC1A2E8C7) establishes that a corpus spanning multiple communication contexts is required to distinguish stable style signals from register-specific adaptations. Features consistent across registers are voice. Features that vary with register are context. This is why both corpus design and scoring are register-aware.

Prosodic compensation (letter elongation, punctuation stacking, emoji as tone marker) draws on research into textual prosody: how writers compensate for the absence of speech prosody in written communication.

### The Engineering Instantiation

```
Psycholinguistic Theory
        ↓ informs schema
Style Profile JSON (34 dimensions, 3 levels)
        ↓                         ↓
Generation Prompt          Three-Layer Scorer
                                   ↓
        ┌──────────────────────────┼──────────────────────────┐
   Layer 1                    Layer 2                    Layer 3
Style Embedding             Programmatic                LLM Judge
AnnaWegmann model           Gaussian scoring            Claude
Content-agnostic            Corpus-derived              Discourse-level
neural similarity           statistics                  pattern match
```

[AnnaWegmann/Style-Embedding](https://huggingface.co/AnnaWegmann/Style-Embedding) was chosen specifically because it was trained contrastively to separate style from content: same-author texts on different topics should be more similar than different-author texts on the same topic. Style/content separation addressed at the model selection level, not through additional engineering.

---

## Architecture

### System Flow

```
Corpus (emails, Slack, texts)
        ↓
[ingest-corpus]
Parses, counts messages, stores in Supabase
        ↓
[extract-style]
Claude extracts 34-dimension style profile
Corpus samples stored, raw text deleted for privacy
        ↓
Style Profile stored in Supabase
        ↓                         ↓
[generate]                   [score]
Claude generates              Three-layer scorer runs
text in voice                 updates generation row
        ↓                         ↓
Generation + Score stored in Supabase
```

### Edge Functions

- **ingest-corpus** — accepts raw text and metadata, parses and stores the corpus
- **extract-style** — calls Claude with the corpus, extracts the 34-dimension profile, stores corpus samples, deletes raw text
- **generate** — calls Claude with the style profile and prompt, stores the output
- **score** — runs the three-layer scorer, updates the generation row
- **delete-corpus** — cascades deletion through profiles, generations, and scores
- **delete-generation** — removes individual generations

### Generation Pipeline

The generator is a swappable module with a fixed interface:

```
generate(style_profile_id, prompt, context_type) → output
```

**V1 (shipped):** Single Claude call with the full style profile injected into the system prompt.

**V2 (designed):** Two-stage pipeline. Stage 1 generates a content-faithful draft. Stage 2 translates it into the target voice using the profile and corpus examples as few-shot demonstrations. In-context style transfer outperforms fine-tuning at low data regimes, which is why V1 ships first. V2 becomes strictly better at scale.

**V3 (future):** Stage 2 replaced by a fine-tuned mini model trained on the corpus. Same interface, no changes to the rest of the system.

### Tech Stack

- **Frontend:** React via Lovable, deployed to custom domain
- **Backend:** Supabase Edge Functions (Deno/TypeScript)
- **Database:** Supabase Postgres
- **Style Extraction and Generation:** Anthropic API (claude-sonnet-4-6)
- **Style Embedding:** AnnaWegmann/Style-Embedding via HuggingFace Inference API
- **AI Tooling:** Claude (architecture, prompts, extraction), Codex (backend), Lovable (frontend)

---

## The Three-Layer Scorer

```
Generated Text
        ↓                    ↓                    ↓
   Layer 1              Layer 2              Layer 3
Style Embedding       Programmatic          LLM Judge
Neural similarity     Corpus-derived        Higher-order
against corpus        gaussian scoring      discourse match
        ↓                    ↓                    ↓
    Weighted combination (register-aware, data-adaptive)
                             ↓
                   Overall Score + Breakdown
```

### Layer 1: Style Embedding

Uses [AnnaWegmann/Style-Embedding](https://huggingface.co/AnnaWegmann/Style-Embedding), a RoBERTa model trained for stylistic similarity rather than semantic similarity. The generated text is encoded alongside a stratified corpus sample and cosine similarity is normalized against a within-corpus baseline.

Standard cosine normalization clips negative values to zero, discarding real information. The correct approach maps the full [-1, 1] range before normalizing:

```
normalizedRaw      = (raw + 1) / 2
normalizedBaseline = (baseline + 1) / 2
score              = normalizedRaw / normalizedBaseline * 0.85
```

### Layer 2: Programmatic Scorer

Every threshold is computed from the actual corpus. No hardcoded values. This means the scorer adapts to any writer automatically.

For continuous features, scoring uses a Gaussian penalty centered on the corpus mean:

```
score = exp(-0.5 * ((generated - corpus_mean) / corpus_std)^2)
```

High corpus standard deviation means the writer is naturally variable on that feature, so the scorer is automatically more forgiving. For binary features (emoji presence, doubling patterns), a standard Gaussian fails because it penalizes any deviation from the mean symmetrically. Binary features use a tendency-weighted score that rewards agreement with the corpus tendency, scaled by how strong that tendency is.

### Layer 3: LLM Judge

Evaluates higher-order style dimensions that resist programmatic measurement: register match, information structure, social orientation, politeness strategy, and opener/closer pattern alignment. The LLM judge receives only the global and mid-level sections of the style profile to prevent double-counting surface features already covered by Layer 2.

### Dynamic Weighting

The three layers are combined with weights that adapt to data availability:

- When the corpus has fewer than 50 messages, the programmatic scorer is down-weighted proportionally. Weight scales as `min(n/50, 1)`, a reliability weighting derived from the Law of Large Numbers.
- When style embedding returns a negative raw similarity (common when the corpus is predominantly casual but the generation is formal), full-range normalization handles it rather than zero-clipping.
- When style embedding is unavailable (HuggingFace cold start or timeout), its weight redistributes to the LLM judge automatically.

This is an implicit Bayesian ensemble. With abundant data, the data-driven layers dominate. With sparse data, the linguistically-informed prior (LLM judge) dominates. The ensemble degrades gracefully rather than failing.

### Register-Aware Scoring

Both the programmatic scorer and style embedding use register-matched comparisons. A formal email generation is scored against corpus emails and normalized against the email-to-email baseline, not the global corpus baseline. This prevents the scorer from penalizing register-appropriate behavior as a style mismatch.

---

## How I Built It

### AI Tooling

**Claude** was the thinking partner for the entire architecture. The psycholinguistic framing, profile schema design, scoring methodology, and every prompt in the system were developed conversationally before a single line of code was written. Claude also runs inside the app itself for extraction, generation, and LLM judging. Claude was chosen over other models for its superior natural language generation and instruction-following precision, both of which matter enormously when output quality is the product.

**Codex** handled all backend implementation. The six Edge Functions, Supabase schema, RLS policies, and deployment were written and iterated by Codex connected to the repo via MCP. The Supabase MCP connection meant Codex could create tables, run migrations, and verify deployments directly without copy-pasting SQL.

**Lovable** built the entire frontend. The design brief specified a dark research-tool aesthetic inspired by Linear and Perplexity, with a terminal-style loading animation tied to real API timing, a collapsible profile display, and a three-layer score breakdown.

### Development Order

1. Designed the style profile schema before writing any code
2. Validated the full pipeline in Google Colab before productionizing
3. Built and tested each Edge Function individually with curl smoke tests
4. Built the frontend against mock data, then wired to real APIs
5. Iterated on the UI with real corpus data

Validating in Colab first was the right call. The scorer went through several iterations (Gaussian vs hard thresholds, global vs register-aware baselines, full-range cosine normalization) that would have been painful to debug inside a deployed Edge Function.

---

## Considerations

### What happens when the corpus is small?

Small corpora affect extraction and scoring differently.

At extraction, the core problem is distinguishing "not observed" from "not present." A feature absent from a 10-message corpus may simply be unobserved, not genuinely absent. The extraction prompt explicitly instructs Claude to make this distinction and to flag dimensions with thin evidence in an `extraction_metadata` block. The UI surfaces these flags directly on the profile page.

At scoring, small n produces wide confidence intervals on corpus statistics. Each feature's confidence interval is computed as `1.96 * std / sqrt(n)`. Features whose intervals exceed 50% of the mean are automatically down-weighted. The ensemble weight on the programmatic scorer scales as `min(n/50, 1)`, shifting toward the LLM judge as data decreases. This is a principled Bayesian fallback: with sparse data, the linguistically-informed prior dominates over the noisy likelihood. [Pennebaker's LIWC research](https://www.science.org/doi/10.1126/science.290.5490.248) establishes approximately 1,000 words as the minimum for reliable psycholinguistic feature extraction, which directly informed these thresholds.

The app enforces a minimum of 5 messages at upload and surfaces confidence levels (high, medium, low) throughout the profile and score display.

### How do you distinguish style from content?

This is the hardest problem in stylometric analysis. Three layers of separation are in place.

The extraction prompt explicitly instructs Claude to ask: "Would this pattern appear regardless of what the person was writing about? If no, it is content. If yes, it is style."

The generation prompt instructs Claude to match how the person writes, not what they write about.

The [AnnaWegmann/Style-Embedding](https://huggingface.co/AnnaWegmann/Style-Embedding) model addresses this at the measurement layer. It was trained contrastively so that same-author texts on different topics are more similar than different-author texts on the same topic, making the style embedding inherently content-agnostic.

A more systematic treatment would add function word profiling (Pennebaker's most content-independent style signal), content neutralization before embedding, and cross-register consistency validation to identify which features are stable across topics. These are the clearest next steps.

### How would this scale to 10,000 messages?

Three components need architectural changes at scale.

Extraction cannot send 10,000 messages to Claude in one prompt. The solution is chunked MapReduce extraction: divide the corpus into stratified chunks of roughly 150 messages per register, extract partial profiles from each, then merge by averaging numerical scores and taking the union of qualitative fields. Extraction becomes an async background job rather than a synchronous request.

Style embedding becomes expensive at scale. The solution is to store message embeddings in Supabase using pgvector, compute them incrementally as messages arrive, and use approximate nearest neighbor search at scoring time rather than re-encoding everything fresh.

The profile becomes incrementally updatable. New messages nudge the existing profile rather than triggering full re-extraction, and enable drift detection if a person's writing style changes over time.

Corpus statistics (mean, std per feature) are O(n) arithmetic and scale without any architectural change.

### What are the privacy implications?

Personal communications contain intimate data by definition. Four mitigations are implemented.

Raw corpus text is deleted immediately after style extraction. Only the lossy style profile and a small stratified sample of messages (45 messages maximum, used for scoring) are retained. The profile cannot be used to reconstruct the original messages.

An explicit consent checkbox requires users to confirm the writing is their own before processing begins. A disclosure note informs users that text is sent to Anthropic's API for analysis.

One-click corpus deletion cascades through all derived data including profiles, generations, and scores via database foreign key constraints.

The most privacy-preserving future direction is local model inference, where the style extractor runs on-device and raw communications never leave the user's machine.

---

## What's Next

### V2 Generation Pipeline

The generator is architected to be swappable. V2 separates content generation from style transfer into two sequential Claude calls. Stage 1 generates a content-faithful draft. Stage 2 translates it into the target voice using the profile and corpus examples as few-shot demonstrations. In-context style transfer outperforms fine-tuning at low data regimes, which is why V1 ships first.

### Function Word Analysis

[Pennebaker's research](https://www.science.org/doi/10.1126/science.290.5490.248) identifies function words (articles, prepositions, conjunctions, pronouns) as the most reliable and content-independent style signals. Adding a dedicated function word frequency profile as a fourth scoring layer would make the style/content separation more systematic and the scorer more robust to topic shift.

### Systematic Style/Content Separation

A more rigorous treatment would add content neutralization before embedding (replacing named entities and domain nouns with generic tokens before computing style similarity), cross-register consistency validation (features stable across all three registers are voice, features that vary are context), and topic modeling to measure style on the residual variance unexplained by topic.

### Fine-Tuned Mini Model

At sufficient corpus size (roughly 500 messages and above), a small model fine-tuned directly on the corpus would outperform in-context style transfer for the generation stage. The architecture anticipates this: the generate Edge Function interface is fixed, and swapping the second stage to a fine-tuned endpoint requires no changes to the rest of the system.

### Local Inference

Running both extraction and generation on-device would eliminate the privacy tradeoff entirely. Raw communications would never leave the user's machine. This is the most meaningful long-term direction for a tool that ingests personal data.

---

## Corpus

The demo corpora are included at `corpus/reza_corpus.txt` and `corpus/hillary_emails_cleaned.txt`.

`corpus/reza_corpus.txt` contains 276 messages across three registers: WhatsApp personal conversations, Slack professional messages, and sent emails. It spans casual social coordination, professional technical collaboration, and formal academic and job-seeking correspondence, providing enough register variation to validate the multi-register extraction and register-aware scoring system.

`corpus/hillary_emails_cleaned.txt` is included as a second evaluation corpus centered on email writing, useful for testing the pipeline on a much more formal and single-register communication style.
