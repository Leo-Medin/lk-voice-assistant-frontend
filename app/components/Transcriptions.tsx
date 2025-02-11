import React, { useEffect, useState } from 'react';
import { RoomEvent, TranscriptionSegment, Participant, TrackPublication } from 'livekit-client';
import { useMaybeRoomContext } from '@livekit/components-react';

interface TranscriptionEntry {
  speaker: string;
  text: string;
  isFinal: boolean;
}

const Transcriptions: React.FC = () => {
  const room = useMaybeRoomContext();
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);

  useEffect(() => {
    if (!room) return;

    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
      publication?: TrackPublication
    ) => {
      if (!segments || segments.length === 0) return;

      const speaker = participant?.isLocal ? 'You' : 'Agent';
      const lastSegment = segments[segments.length - 1];

      const text = lastSegment.text.trim();
      const isFinal = lastSegment.final || false;

      setTranscriptions((prev) => {
        if (prev.length > 0 && prev[prev.length - 1].speaker === speaker) {
          // **Word-by-word updating**
          const lastEntry = prev[prev.length - 1];

          if (!lastEntry.isFinal) {
            return [
              ...prev.slice(0, -1),
              { speaker, text, isFinal },
            ];
          }
        }

        // **Only add new entry if it’s a finalized message**
        return [...prev, { speaker, text, isFinal }];
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);

    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room]);

  return (
    <div className="transcriptions p-4 bg-gray-100 shadow-md rounded-md h-48 overflow-y-auto">
      <h3 className="text-lg font-bold mb-2">Live Transcriptions</h3>
      {transcriptions.map((entry, index) => (
        <p key={index} className={entry.speaker === "You" ? "text-blue-600" : "text-black"}>
          <strong>{entry.speaker}:</strong> {entry.text}
        </p>
      ))}
    </div>
  );
};

export default Transcriptions;
