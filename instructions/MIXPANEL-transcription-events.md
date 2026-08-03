# Mixpanel — proposed events: Media Library → Transcription

**Status:** proposal for review · **Owner to sync into Notion:** TeamLead **Oleg Kravets**
**Date:** 2026-07-23 · **Source:** static prototype `subsub_front_prototype_14.07.26` (Media Library transcription flow)

> ⚠️ **Context / caveats**
> - The **prototype has no analytics layer** — these events are **not instrumented** in the prototype code. This table describes the user actions the transcription UI introduces so tracking can be added when the flow lands in the real product (`subsub_platform_front`).
> - The canonical Mixpanel tracking spec lives in Notion (*MixPanel Data / Track Event List*). It **could not be fetched in this session** (the Notion connector requires interactive OAuth, unavailable here), so **event names/property conventions below are proposals and must be reconciled with the existing spec** before implementation (reuse existing names where the spec already has an equivalent; keep the spec's casing/prefix convention).
> - This covers the **transcription** flow only (the surface changed in this iteration). CTAs / form inputs / dialog per the org tracking regulation.

## Proposed events

| # | Event (proposed) | Trigger (UI) | Suggested properties | Description |
|---|---|---|---|---|
| 1 | `Transcription Modal Opened` | User opens the "Transcribe file" dialog from the file `⋮` menu → **Transcribe** | `file_id`, `file_type` (video/audio), `source` (`row_menu`) | Dialog to configure a transcription is shown. |
| 2 | `Transcription Language Selected` | User toggles a language in the **Transcription language** multiselect | `file_id`, `language`, `selected` (bool), `total_selected` | A target language is added/removed. Fires per toggle. |
| 3 | `Transcription Started` | User clicks **Start transcription** | `file_id`, `file_type`, `languages` (array), `languages_count` | Transcription job(s) started (one transcript per selected language). |
| 4 | `Transcription Completed` | Job finishes (system, not a click) | `file_id`, `languages_count`, `duration_ms` | Result files created. Optional/system-side; include if backend emits. |
| 5 | `Transcription Reviewed` | User opens a finished transcript — `⋮` → **Review transcription**, notification **View**, or job-card **Go to file** | `file_id`, `language`, `entry_point` (`row_menu` \| `notification` \| `job_card`) | The transcript result modal is opened. |
| 6 | `Transcript Regenerated` | User clicks **Regenerate** inside the transcript result modal | `file_id`, `language` | Re-runs generation for the open transcript. |
| 7 | `Transcript Exported` | User picks a format under **Download As** (SRT / PDF / TXT) | `file_id`, `language`, `format` (`srt` \| `pdf` \| `txt`), `max_words_per_segment` (SRT only) | Transcript downloaded in the chosen format. Use one event with a `format` property (preferred) rather than 3 separate events. |
| 8 | `Transcript Copied` | User clicks **Copy** in the transcript result modal | `file_id`, `language` | Full transcript text copied to clipboard. |

## Notes for implementation

- **Prefer a single `Transcript Exported` event with a `format` property** over per-format events (`..._srt` / `..._pdf` / `..._txt`) — easier to break down in Mixpanel and matches typical spec hygiene. If the Notion spec already standardizes per-format events, follow the spec instead.
- `max_words_per_segment` is only meaningful for `format = srt` (default 8); omit for PDF/TXT.
- Event **names and property keys above are placeholders** — align casing/prefix (e.g. a `Media Library:` or `transcription_` prefix) with the existing Notion list before coding.

---
**Action:** please review and, once names are reconciled with the Notion spec, ask Oleg Kravets to add/confirm these in *MixPanel Data / Track Event List*.
