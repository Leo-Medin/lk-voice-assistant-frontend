import React, { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { RoomEvent, TranscriptionSegment, Participant } from 'livekit-client';
import { useMaybeRoomContext } from '@livekit/components-react';

interface TranscriptionEntry {
    speaker: string;
    text: string;
    isFinal: boolean;
    segmentId: string;
    ts: number; // stable timestamp for ordering
}

type UiLang = "en" | "el" | "ru";

// Very simple script-based detector for MVP.
// Note: Ukrainian/Bulgarian will fall into "ru" bucket due to Cyrillic.
function detectLangByScript(text: string): UiLang | "unknown" {
    const t = text.trim();
    if (!t) return "unknown";

    // Greek Unicode ranges (rough but effective)
    if (/[Ͱ-Ͽἀ-῿]/u.test(t)) return "el";

    // Cyrillic range
    if (/[Ѐ-ӿ]/u.test(t)) return "ru";

    // Latin letters
    if (/[A-Za-z]/.test(t)) return "en";

    return "unknown";
}

function placeholderFor(lastAgentLang: UiLang) {
    switch (lastAgentLang) {
        case "el":
            return "(Μη αναγνωρίσιμη γλώσσα)";
        case "ru":
            return "(Нераспознанный язык)";
        default:
            return "(Unrecognized language)";
    }
}

const Transcriptions = ({ transcriptions, setTranscriptions }: { transcriptions: TranscriptionEntry[], setTranscriptions: Dispatch<SetStateAction<TranscriptionEntry[]>> }) => {
  const room = useMaybeRoomContext();
  const scrollRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling
  const segmentTsRef = useRef<Map<string, number>>(new Map());
  const lastAgentLangRef = useRef<UiLang>("en");

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[], participant?: Participant) => {
      if (!segments?.length) return;

      const speaker = participant?.isLocal ? "You" : "Agent";
      const seg = segments[segments.length - 1];
      const text = (seg.text ?? "").trim();
      // if (!text || text === "…" || text === "...") return;

      // Update last agent language based on agent messages
      if (speaker === "Agent" && text) {
        const l = detectLangByScript(text);
        if (l !== "unknown") lastAgentLangRef.current = l;
      }

      // For local user transcripts, hide anything not in EN/EL/RU.
      // This prevents showing random-language garbage in noisy conditions.
      let displayText = text;

      if (speaker === "You") {
        const l = detectLangByScript(text);
        const isAllowed = l === "en" || l === "el" || l === "ru";

        // Optional: treat very short utterances as allowed (e.g., "ok", "yes", "да")
        // Otherwise short noise sometimes becomes "(Unrecognized language)" and looks odd.
        const isVeryShort = text.length > 0 && text.length <= 2;

        if (!isAllowed && !isVeryShort) {
            displayText = placeholderFor(lastAgentLangRef.current);
        }
      }

      const isFinal = !!seg.final;
      const segmentId = seg.id ?? `${speaker}-${text.slice(0, 16)}`; // seg.id should exist

      // stable timestamp for this segment id
      let ts = segmentTsRef.current.get(segmentId);
      if (!ts) {
          ts = Date.now();
          segmentTsRef.current.set(segmentId, ts);
      }

      setTranscriptions((prev) => {
          const idx = prev.findIndex((e) => e.segmentId === segmentId);
          if (idx !== -1) {
              const next = prev.slice();
              next[idx] = { ...next[idx], speaker, text: displayText, isFinal };
              return next;
          }
          return [...prev, { speaker, text: displayText, isFinal, segmentId, ts }];
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room]);

  // **Auto-scroll when new transcription is added**
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]); // Runs every time transcriptions change

  return (
    <div ref={scrollRef} className="transcriptions p-4 bg-gray-100 shadow-md rounded-md h-48 overflow-y-auto">
      <h3 className="text-lg font-bold mb-2" style={{ color: 'lightgrey' }}>Live Transcriptions</h3>
        {[...transcriptions]
            .sort((a, b) => a.ts - b.ts)
            .map((entry, index) => (
                <p key={entry.segmentId ?? index} className={entry.speaker === "You" ? "text-blue-600" : "text-black"}>
                    <strong>{entry.speaker}:</strong> {entry.text}
                </p>
        ))}
    </div>
  );
};

export default Transcriptions;
