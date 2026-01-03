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

const Transcriptions = ({ transcriptions, setTranscriptions }: { transcriptions: TranscriptionEntry[], setTranscriptions: Dispatch<SetStateAction<TranscriptionEntry[]>> }) => {
  const room = useMaybeRoomContext();
  const scrollRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling
  const segmentTsRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (segments: TranscriptionSegment[], participant?: Participant) => {
      if (!segments?.length) return;

      const speaker = participant?.isLocal ? "You" : "Agent";
      const seg = segments[segments.length - 1];
      const text = (seg.text ?? "").trim();
      // if (!text || text === "…" || text === "...") return;

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
              next[idx] = { ...next[idx], speaker, text, isFinal };
              return next;
          }
          return [...prev, { speaker, text, isFinal, segmentId, ts }];
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
