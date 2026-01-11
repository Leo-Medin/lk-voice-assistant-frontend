import React, { Dispatch, SetStateAction, useEffect, useRef } from 'react';
import { RoomEvent, TranscriptionSegment, Participant } from 'livekit-client';
import { useMaybeRoomContext } from '@livekit/components-react';

export interface TranscriptionEntry {
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
    const t = (text ?? '').trim();
    if (!t) return 'en';

    // Greek and Coptic + Greek Extended
    if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(t)) return 'el';

    // Cyrillic + Cyrillic Supplement + Cyrillic Extended-A/B
    if (/[\u0400-\u04FF\u0500-\u052F\u2DE0-\u2DFF\uA640-\uA69F]/.test(t)) return 'ru';

    return 'en';
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
        <div ref={scrollRef} className="transcriptions p-4 bg-transparent flex-1 h-full overflow-y-auto min-h-0">
          <div className="max-w-[1200px] mx-auto flex flex-col gap-2">
            {[...transcriptions]
                .sort((a, b) => a.ts - b.ts)
                .map((entry, index) => {
                    const isLocal = entry.speaker === "You";
                    const isSystem = entry.speaker === "System";

                    if (isSystem) {
                        return (
                            <div key={entry.segmentId ?? index} className="self-center my-2">
                                <span className="bg-gray-800 text-gray-400 text-[10px] px-2 py-1 rounded-full uppercase tracking-wider">
                                    {entry.text}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={entry.segmentId ?? index}
                            className={`max-w-[80%] min-w-[30%] p-3 rounded-2xl text-sm shadow-sm ${
                                isLocal
                                    ? "bg-green-700 text-white self-end rounded-tr-none"
                                    : "bg-gray-800 text-gray-100 self-start rounded-tl-none"
                            }`}
                        >
                            <div className={`text-[10px] mb-1 opacity-60 font-bold uppercase`}>
                                {entry.speaker}
                            </div>
                            <div>{entry.text}</div>
                        </div>
                    );
                })}
          </div>
        </div>
      );
    };

    export default Transcriptions;
