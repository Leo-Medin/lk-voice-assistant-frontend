"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  LiveKitRoom,
  useVoiceAssistant,
  BarVisualizer,
  RoomAudioRenderer,
  VoiceAssistantControlBar,
  AgentState,
  DisconnectButton,
} from "@livekit/components-react";
import React, { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { MediaDeviceFailure, RoomEvent } from "livekit-client";
import type { ConnectionDetails } from "../api/connection-details/route";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { CloseIcon } from "@/components/CloseIcon";
import Transcriptions, { TranscriptionEntry } from "../components/Transcriptions";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import { Mic, Ear, Loader2, PowerOff, X } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface Citation {
  source: string;
  text?: string;
}

function CitationDisplay() {
  const room = useRoomContext();
  const [citations, setCitations] = useState<Citation[]>([]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      const decoder = new TextDecoder();
      const str = decoder.decode(payload);
      try {
        const data = JSON.parse(str);
        if (data.type === "citations") {
          setCitations(data.citations);
        }
      } catch (e) {
        console.error("Failed to parse data message", e);
      }
    };

    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);

  if (citations.length === 0) return null;

  return (
    <div className="citations-container max-w-[90vw] mx-auto mb-4 p-3">
      <ul className="flex flex-wrap gap-2 text-xs">
        {citations.map((c, i) => (
          <li
            key={i}
            title={c.text}
            className="bg-gray-700 px-2 py-1 rounded text-gray-200 cursor-help"
          >
            {c.source}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusIndicator({ state }: { state: AgentState }) {
  const statuses = [
    { id: "disconnected", icon: PowerOff, label: "OFF" },
    { id: "connecting", icon: Loader2, label: "Wait" },
    { id: "listening", icon: Ear, label: "Ear" },
    { id: "speaking", icon: Mic, label: "Talk" },
  ];

  return (
    <div className="flex flex-row gap-2 justify-center items-center my-2 w-full max-w-[375px] mx-auto">
      {statuses.map((status) => {
        const isActive =
          (status.id === "disconnected" && state === "disconnected") ||
          (status.id === "connecting" && (state === "connecting" || state === "initializing")) ||
          (status.id === "listening" && state === "listening") ||
          (status.id === "speaking" && state === "speaking");

        const Icon = status.icon;

        return (
          <div
            key={status.id}
            className={`
              flex flex-col items-center justify-center
              w-14 h-14 sm:w-16 sm:h-16 rounded-xl border transition-all duration-300
              ${isActive
                ? "bg-orange-950/40 text-orange-500 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                : "bg-gray-900/50 text-gray-600 border-gray-800"}
            `}
          >
            <Icon size={24} className={status.id === "connecting" && isActive ? "animate-spin" : ""} />
            <span className="text-[10px] mt-1 uppercase font-bold tracking-tighter opacity-80">
              {status.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WidgetHeader({ title }: { title: string }) {
  const handleClose = () => {
    window.parent.postMessage({ type: "lk-widget:closed" }, "*");
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
      <span className="text-sm font-semibold text-gray-200">{title}</span>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-200 transition-colors"
        aria-label="Close widget"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function WidgetStateReporter({ agentState }: { agentState: AgentState }) {
  const prevStateRef = useRef<AgentState | null>(null);

  useEffect(() => {
    if (prevStateRef.current === agentState) return;
    prevStateRef.current = agentState;

    window.parent.postMessage({ type: "lk-widget:agent-state", state: agentState }, "*");

    if (agentState === "listening" || agentState === "speaking") {
      window.parent.postMessage({ type: "lk-widget:connected" }, "*");
    } else if (agentState === "disconnected") {
      window.parent.postMessage({ type: "lk-widget:disconnected" }, "*");
    }
  }, [agentState]);

  return null;
}

function SimpleVoiceAssistant({ onStateChange }: { onStateChange: (state: AgentState) => void }) {
  const { state, audioTrack } = useVoiceAssistant();

  useEffect(() => {
    onStateChange(state);
  }, [state, onStateChange]);

  return (
    <div className="max-w-[90vw] mx-auto flex flex-col shrink-0">
      <BarVisualizer
        state={state}
        barCount={5}
        trackRef={audioTrack}
        className="agent-visualizer"
        options={{ minHeight: 24 }}
        style={{ height: "120px" }}
      />
      <StatusIndicator state={state} />
      <div style={{ textAlign: "center", color: "gray", marginBottom: "4px", fontSize: "12px" }}>
        {state}
      </div>
    </div>
  );
}

function WidgetControlBar(props: {
  onConnectButtonClicked: () => void;
  agentState: AgentState;
}) {
  return (
    <div
      className="relative shrink-0"
      style={{ display: "flex", flexDirection: "column", marginBottom: "8px", minHeight: 60 }}
    >
      <AnimatePresence>
        {props.agentState === "disconnected" && (
          <motion.button
            initial={{ opacity: 0, top: 20, width: "fit-content", marginLeft: "auto", marginRight: "auto" }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="uppercase left-1/2 px-4 py-2 bg-white text-black rounded-md"
            onClick={() => props.onConnectButtonClicked()}
          >
            Start a conversation
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {props.agentState !== "disconnected" && props.agentState !== "connecting" && (
          <motion.div
            initial={{ opacity: 0, top: "10px", marginBottom: "15px" }}
            animate={{ opacity: 1, top: 0 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="flex h-8 justify-center"
          >
            <VoiceAssistantControlBar controls={{ leave: false }} />
            <DisconnectButton>
              <CloseIcon />
            </DisconnectButton>
          </motion.div>
        )}
      </AnimatePresence>
      {props.agentState !== "disconnected" && props.agentState !== "connecting" && (
        <CitationDisplay />
      )}
    </div>
  );
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error(error);
  alert(
    "Error acquiring microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}

function InactivityAutoDisconnect({
  agentState,
  lastActivityRef,
  inactivityIntervalRef,
  timeoutMs = 15000,
  setTranscriptions,
}: {
  agentState: AgentState;
  lastActivityRef: React.MutableRefObject<number>;
  inactivityIntervalRef: React.MutableRefObject<number | null>;
  timeoutMs?: number;
  setTranscriptions: React.Dispatch<React.SetStateAction<TranscriptionEntry[]>>;
}) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room || agentState === "disconnected") {
      if (inactivityIntervalRef.current) {
        window.clearInterval(inactivityIntervalRef.current);
        inactivityIntervalRef.current = null;
      }
      return;
    }

    if (inactivityIntervalRef.current) {
      window.clearInterval(inactivityIntervalRef.current);
      inactivityIntervalRef.current = null;
    }

    inactivityIntervalRef.current = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs > timeoutMs && agentState !== "speaking") {
        if (inactivityIntervalRef.current) {
          window.clearInterval(inactivityIntervalRef.current);
          inactivityIntervalRef.current = null;
        }
        setTranscriptions((prev) => [
          ...prev,
          {
            speaker: "System",
            text: "Disconnected due to inactivity.",
            isFinal: true,
            segmentId: `system-inactivity-${Date.now()}`,
            ts: Date.now(),
          },
        ]);
        room.disconnect(true);
      }
    }, 1000);

    return () => {
      if (inactivityIntervalRef.current) {
        window.clearInterval(inactivityIntervalRef.current);
        inactivityIntervalRef.current = null;
      }
    };
  }, [room, agentState, timeoutMs, setTranscriptions]);

  return null;
}

function SessionCues({
  agentState,
  readyUrl = "/sounds/ready.mp3",
  stopUrl = "/sounds/stop.mp3",
  readyMuteMs = 500,
  setTranscriptions,
}: {
  agentState: AgentState;
  readyUrl?: string;
  stopUrl?: string;
  readyMuteMs?: number;
  setTranscriptions: React.Dispatch<React.SetStateAction<TranscriptionEntry[]>>;
}) {
  const room = useRoomContext();
  const readyAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopAudioRef = useRef<HTMLAudioElement | null>(null);
  const readyPlayedThisSessionRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const hasProcessedTimeoutRef = useRef(false);

  useEffect(() => {
    if (agentState === "disconnected") {
      readyPlayedThisSessionRef.current = false;
      hasProcessedTimeoutRef.current = false;
    }
  }, [agentState]);

  useEffect(() => {
    if (!readyAudioRef.current) {
      const a = new Audio(readyUrl);
      a.volume = 0.6;
      a.preload = "auto";
      readyAudioRef.current = a;
    }
    if (!stopAudioRef.current) {
      const a = new Audio(stopUrl);
      a.volume = 0.6;
      a.preload = "auto";
      stopAudioRef.current = a;
    }
  }, [readyUrl, stopUrl]);

  useEffect(() => {
    if (!room) return;
    if (agentState !== "listening") return;
    if (readyPlayedThisSessionRef.current) return;

    readyPlayedThisSessionRef.current = true;

    const run = async () => {
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
        if (readyAudioRef.current) {
          readyAudioRef.current.currentTime = 0;
          await readyAudioRef.current.play().catch(() => {});
        }
        if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        timeoutRef.current = window.setTimeout(async () => {
          if (room.state === ConnectionState.Connected) {
            await room.localParticipant.setMicrophoneEnabled(true);
          }
        }, readyMuteMs);
      } catch {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch {}
      }
    };

    void run();

    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [agentState, room, readyMuteMs]);

  useEffect(() => {
    if (!room) return;

    const onDisconnected = () => {
      if (stopAudioRef.current) {
        stopAudioRef.current.currentTime = 0;
        void stopAudioRef.current.play().catch(() => {});
      }
      readyPlayedThisSessionRef.current = false;
    };

    room.on("disconnected", onDisconnected);
    room.on(RoomEvent.DataReceived, (payload) => {
      const data = JSON.parse(new TextDecoder().decode(payload));
      if (data.type === "session_timeout" && !hasProcessedTimeoutRef.current) {
        hasProcessedTimeoutRef.current = true;
        setTranscriptions((prev) => [
          ...prev,
          {
            speaker: "System",
            text: "Disconnected due to session time limit.",
            isFinal: true,
            segmentId: `system-${Date.now()}`,
            ts: Date.now(),
          },
        ]);
        room.disconnect();
      }
    });

    return () => {
      room.off("disconnected", onDisconnected);
    };
  }, [room]);

  return null;
}

function WidgetPageInner() {
  const searchParams = useSearchParams();
  const title = searchParams.get("title") ?? "AI Assistant";

  const [connectionDetails, updateConnectionDetails] = useState<ConnectionDetails | undefined>(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    window.parent.postMessage({ type: "lk-widget:ready" }, "*");
    fetch("/api/warmup", { method: "GET", cache: "no-store" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (transcriptions.length > 0) {
      lastActivityRef.current = Date.now();
    }
  }, [transcriptions]);

  useEffect(() => {
    if (agentState === "speaking") {
      lastActivityRef.current = Date.now();
    }
  }, [agentState]);

  const onConnectButtonClicked = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      onDeviceFailure(err as MediaDeviceFailure);
      return;
    }

    lastActivityRef.current = Date.now();
    setTranscriptions([]);

    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ?? "/api/connection-details",
      window.location.origin
    );
    const response = await fetch(url.toString());
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);
  }, []);

  return (
    <main
      data-lk-theme="default"
      className="h-full flex flex-col bg-[var(--lk-bg)] overflow-hidden"
    >
      <WidgetHeader title={title} />
      <LiveKitRoom
        token={connectionDetails?.participantToken}
        serverUrl={connectionDetails?.serverUrl}
        connect={connectionDetails !== undefined}
        audio={{
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        }}
        video={false}
        onMediaDeviceFailure={onDeviceFailure}
        onDisconnected={() => {
          updateConnectionDetails(undefined);
        }}
        className="flex flex-col h-full overflow-hidden"
      >
        <WidgetStateReporter agentState={agentState} />
        <InactivityAutoDisconnect
          agentState={agentState}
          lastActivityRef={lastActivityRef}
          inactivityIntervalRef={inactivityIntervalRef}
          timeoutMs={15000}
          setTranscriptions={setTranscriptions}
        />
        <RoomAudioRenderer />
        <NoAgentNotification state={agentState} />
        <SimpleVoiceAssistant onStateChange={setAgentState} />
        <Transcriptions transcriptions={transcriptions} setTranscriptions={setTranscriptions} />
        <WidgetControlBar
          onConnectButtonClicked={onConnectButtonClicked}
          agentState={agentState}
        />
        <SessionCues agentState={agentState} setTranscriptions={setTranscriptions} />
      </LiveKitRoom>
    </main>
  );
}

export default function WidgetPage() {
  return (
    <Suspense>
      <WidgetPageInner />
    </Suspense>
  );
}
