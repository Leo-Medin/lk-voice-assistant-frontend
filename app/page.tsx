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
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaDeviceFailure } from "livekit-client";
import type { ConnectionDetails } from "./api/connection-details/route";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { CloseIcon } from "@/components/CloseIcon";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import Transcriptions from "./components/Transcriptions";
import { useRoomContext } from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export default function Page() {
  const [connectionDetails, updateConnectionDetails] = useState<
    ConnectionDetails | undefined
  >(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityIntervalRef = useRef<number | null>(null);
  const [noisyMode, setNoisyMode] = useState(false);

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
    // Generate room connection details, including:
    //   - A random Room name
    //   - A random Participant name
    //   - An Access Token to permit the participant to join the room
    //   - The URL of the LiveKit server to connect to
    //
    // In real-world application, you would likely allow the user to specify their
    // own participant name, and possibly to choose from existing rooms to join.

    lastActivityRef.current = Date.now();

    setTranscriptions([]); // Clear old transcriptions

    const url = new URL(
      process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT ??
      "/api/connection-details",
      window.location.origin
    );
    const response = await fetch(url.toString());
    const connectionDetailsData = await response.json();
    updateConnectionDetails(connectionDetailsData);
  }, []);

  return (
    <main
      data-lk-theme="default"
      className="h-full content-center bg-[var(--lk-bg)]"
    >
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
        className="grid-rows-[2fr_1fr] items-center"
      >
        <InactivityAutoDisconnect
          agentState={agentState}
          lastActivityRef={lastActivityRef}
          inactivityIntervalRef={inactivityIntervalRef}
          timeoutMs={15000}
        />
        <SimpleVoiceAssistant onStateChange={setAgentState} noisyMode={noisyMode} setNoisyMode={setNoisyMode}/>
        <ControlBar
          onConnectButtonClicked={onConnectButtonClicked}
          agentState={agentState}
          noisyMode={noisyMode}
        />
        <RoomAudioRenderer />
        <NoAgentNotification state={agentState} />
        <Transcriptions transcriptions={transcriptions} setTranscriptions={setTranscriptions}/>
      </LiveKitRoom>
    </main>
  );
}

function SimpleVoiceAssistant({ onStateChange, noisyMode, setNoisyMode }: { onStateChange: (state: AgentState) => void, noisyMode: boolean, setNoisyMode: () => void }): void {
  const { state, audioTrack } = useVoiceAssistant();

  useEffect(() => {
    // console.log("Updating agentState to:", state);
    onStateChange(state); // Ensure UI updates correctly
  }, [state]);

  useEffect(() => {
    // console.log("useEffect triggered for silence detection");
  
    onStateChange(state);
  
    if (!audioTrack?.publication?.track) {
      console.warn("No valid audio track publication found. Waiting...");
      return;
    }
  
    const mediaStreamTrack = audioTrack.publication.track.mediaStreamTrack;
    if (!mediaStreamTrack) {
      console.warn("Could not extract mediaStreamTrack from publication. Waiting...");
      return;
    }
  
    console.log("Valid mediaStreamTrack detected. Proceeding...");
  
    const audioContext = new AudioContext();
    const mediaStream = new MediaStream();
    mediaStream.addTrack(mediaStreamTrack);
  
    if (mediaStream.getTracks().length === 0) {
      console.warn("MediaStream is empty. Skipping silence detection.");
      return;
    }
  
    console.log("Creating audio processing pipeline...");
    // const source = audioContext.createMediaStreamSource(mediaStream);
    // const analyser = audioContext.createAnalyser();
    // source.connect(analyser);
  
    const animationFrameId: number | null = null; // Store animation frame ID

    console.log("Starting silence detection...");
    // checkSilence(); // Start detection
  
    return () => {
      console.log("Cleaning up: Disconnecting LiveKit & stopping silence detection...");
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // ✅ Cancel any pending frame
      }
  
      audioContext.close(); // ✅ Close audio processing
    };
  }, [audioTrack]);

  return (
      <div className="max-w-[90vw] mx-auto">
          <div style={{marginTop: '10px', textAlign: 'center'}}>
              Autolife AI Assistant
          </div>
          <div style={{marginTop: '10px', textAlign: 'center', fontStyle: 'italic', color: 'grey'}}>
              I speak English, Μιλάω ελληνικά, Я говорю по-русски, Je parle français, Ich spreche Deutsch.
          </div>
          <div style={{ marginLeft: 'auto', marginRight: 'auto', width: 'fit-content', marginTop: '10px' }}>
              <input id='noisy-mode' type='checkbox' checked={noisyMode} onChange={() => setNoisyMode(!noisyMode)}/>
              <label htmlFor="noisy-mode" style={{ paddingLeft: 10, color: 'gray' }}>Noisy Environment Mode</label>
          </div>
          <BarVisualizer state={state} barCount={5} trackRef={audioTrack} className="agent-visualizer"
                         options={{minHeight: 24}} style={{ height: '200px' }}/>
          <div style={{textAlign: "center", color: "gray", marginBottom: '10px' }}>{state}</div>
      </div>
  );
}

function ControlBar(props: {
  onConnectButtonClicked: () => void;
  agentState: AgentState;
  noisyMode: boolean;
}) {
  /**
   * Use Krisp background noise reduction when available.
   * Note: This is only available on Scale plan, see {@link https://livekit.io/pricing | LiveKit Pricing} for more details.
   */
  const krisp = useKrispNoiseFilter();
  useEffect(() => {
    krisp.setNoiseFilterEnabled(true);
  }, []);

  // console.log("Current agentState:", props.agentState);

  return (
    <div className="relative" style={{ display: "flex", flexDirection: "column", marginBottom: '15px', minHeight: 100 }}>
      <AnimatePresence>
        {props.agentState === "disconnected" && (
          <motion.button
            initial={{ opacity: 0, top: 20, width: 'fit-content', marginLeft: 'auto', marginRight: 'auto' }}
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
        {props.agentState !== "disconnected" &&
          props.agentState !== "connecting" && (
            <motion.div
              initial={{ opacity: 0, top: "10px", marginBottom: '15px' }}
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
      {(props.agentState === "listening" || props.agentState === "speaking") &&
        <PushToTalk noisyMode={props.noisyMode} />
      }
    </div>
  );
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}

function InactivityAutoDisconnect({
                                      agentState,
                                      lastActivityRef,
                                      inactivityIntervalRef,
                                      timeoutMs = 15000,
                                  }: {
    agentState: AgentState;
    lastActivityRef: React.MutableRefObject<number>;
    inactivityIntervalRef: React.MutableRefObject<number | null>;
    timeoutMs?: number;
}) {
    const room = useRoomContext();

    useEffect(() => {
        if (!room) return;

        // reset and start interval when connected
        if (inactivityIntervalRef.current) {
            window.clearInterval(inactivityIntervalRef.current);
            inactivityIntervalRef.current = null;
        }

        inactivityIntervalRef.current = window.setInterval(() => {
            const idleMs = Date.now() - lastActivityRef.current;

            // Do not disconnect while agent is actively speaking
            if (idleMs > timeoutMs && agentState !== "speaking") {
                room.disconnect(true);
            }
        }, 1000);

        return () => {
            if (inactivityIntervalRef.current) {
                window.clearInterval(inactivityIntervalRef.current);
                inactivityIntervalRef.current = null;
            }
        };
    }, [room, agentState, timeoutMs]);

    return null;
}

function PushToTalk({ noisyMode }: { noisyMode: boolean }) {
    const room = useRoomContext();

    const isConnected = room?.state === ConnectionState.Connected;

    useEffect(() => {
        if (!room || !isConnected) return;

        // Noisy mode: start muted. Non-noisy: start unmuted.
        room.localParticipant.setMicrophoneEnabled(!noisyMode);
    }, [room, isConnected, noisyMode]);

    if (!noisyMode) return null;

    const start = async () => {
        if (!room || room.state !== ConnectionState.Connected) return;
        await room.localParticipant.setMicrophoneEnabled(true);
    };

    const stop = async () => {
        if (!room || room.state !== ConnectionState.Connected) return;
        await room.localParticipant.setMicrophoneEnabled(false);
    };

    // if (isConnected)
    return (
        <button
            className="px-4 py-3 bg-white text-black rounded-md"
            onPointerDown={(e) => { e.preventDefault(); start(); }}
            onPointerUp={(e) => { e.preventDefault(); stop(); }}
            onPointerCancel={(e) => { e.preventDefault(); stop(); }}
            onPointerLeave={(e) => { e.preventDefault(); stop(); }}
            style={{ width: 'fit-content', marginLeft: 'auto', marginRight: 'auto' }}
        >
            Hold to talk
        </button>
    );
}
