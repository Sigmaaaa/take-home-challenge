# take-home-challenge

Take-home challenge workspace.

## Edge Functions

Supabase project: `nfmfdsaznbzwfbftwvps`

All current Edge Functions:
- use `POST`
- return JSON
- have CORS enabled for any origin
- are deployed with `verify_jwt: false`

Base URL:

```text
https://nfmfdsaznbzwfbftwvps.supabase.co/functions/v1
```

### `ingest-corpus`

Path:

```text
/ingest-corpus
```

Request body:

```json
{
  "name": "Reza Corpus v1",
  "raw_text": "full corpus text here",
  "source_type": "mixed",
  "source_label": "WhatsApp + Slack + Email",
  "language": "en"
}
```

Response:

```json
{
  "corpus_id": "uuid"
}
```

Notes:
- `char_count` is computed as JavaScript `raw_text.length`
- `message_count` is computed by counting `---` delimiters

### `extract-style`

Path:

```text
/extract-style
```

Request body:

```json
{
  "corpus_id": "uuid"
}
```

Response:

```json
{
  "style_profile_id": "uuid",
  "profile": {}
}
```

Notes:
- reads the corpus from `corpora`
- passes `source_type` and `source_label` into the Claude prompt as register hints
- replaces any existing style profile for the same `corpus_id`

### `generate`

Path:

```text
/generate
```

Request body:

```json
{
  "style_profile_id": "uuid",
  "prompt": "Confirm dinner tonight and ask if 8 pm still works.",
  "context_type": "casual text to a close friend confirming dinner plans tonight"
}
```

Response:

```json
{
  "generation_id": "uuid",
  "output": "generated text here"
}
```

Notes:
- `context_type` is free text and should not be treated as an enum
- generated rows are persisted to `generations`
- `score` is currently `null` and intended to be filled by a separate scoring step
- `generation_metadata` stores latency and token info when available
