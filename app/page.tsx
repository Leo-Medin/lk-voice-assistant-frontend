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
import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { MediaDeviceFailure } from "livekit-client";
import type { ConnectionDetails } from "./api/connection-details/route";
import { NoAgentNotification } from "@/components/NoAgentNotification";
import { CloseIcon } from "@/components/CloseIcon";
import { useKrispNoiseFilter } from "@livekit/components-react/krisp";
import Transcriptions from "./components/Transcriptions";
import { useRoomContext } from "@livekit/components-react";

interface TranscriptionEntry {
  speaker: string;
  text: string;
  isFinal: boolean;
}
export default function Page() {
  const [connectionDetails, updateConnectionDetails] = useState<
    ConnectionDetails | undefined
  >(undefined);
  const [agentState, setAgentState] = useState<AgentState>("disconnected");
  const silenceStart = useRef<number | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);

  const onConnectButtonClicked = useCallback(async () => {
    // Generate room connection details, including:
    //   - A random Room name
    //   - A random Participant name
    //   - An Access Token to permit the participant to join the room
    //   - The URL of the LiveKit server to connect to
    //
    // In real-world application, you would likely allow the user to specify their
    // own participant name, and possibly to choose from existing rooms to join.

    silenceStart.current = null; // reset silence timeout
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
      className="h-full grid content-center bg-[var(--lk-bg)]"
    >
      <LiveKitRoom
        token={connectionDetails?.participantToken}
        serverUrl={connectionDetails?.serverUrl}
        connect={connectionDetails !== undefined}
        audio={true}
        video={false}
        onMediaDeviceFailure={onDeviceFailure}
        onDisconnected={() => {
          updateConnectionDetails(undefined);
        }}
        className="grid grid-rows-[2fr_1fr] items-center"
      >
        <SimpleVoiceAssistant onStateChange={setAgentState} silenceStart={silenceStart} />
        <ControlBar
          onConnectButtonClicked={onConnectButtonClicked}
          agentState={agentState}
        />
        <RoomAudioRenderer />
        <NoAgentNotification state={agentState} />
        <Transcriptions transcriptions={transcriptions} setTranscriptions={setTranscriptions}/>
      </LiveKitRoom>
    </main>
  );
}

function SimpleVoiceAssistant({ onStateChange, silenceStart }: { onStateChange: (state: AgentState) => void, silenceStart: MutableRefObject<number | null> }) {
  const { state, audioTrack } = useVoiceAssistant();
  const silenceThreshold = -50; // Adjust if needed
  const silenceDuration = 10000; // 10 seconds
  const room = useRoomContext(); // ✅ Get the LiveKit room instance

  useEffect(() => {
    console.log("Updating agentState to:", state);
    onStateChange(state); // Ensure UI updates correctly
  }, [state]);

  // const silenceStart = useRef<number | null>(null);

  useEffect(() => {
    console.log("useEffect triggered for silence detection");
  
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
    const source = audioContext.createMediaStreamSource(mediaStream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
  
    let animationFrameId: number | null = null; // Store animation frame ID
  
    function checkSilence() {
      if (state === "disconnected") {
        console.log("Silence detection stopped.");
        return; // Stop execution when disconnected
      }
  
      const dataArray = new Float32Array(analyser.frequencyBinCount);
      analyser.getFloatFrequencyData(dataArray);
  
      const maxVolume = Math.max(...Array.from(dataArray));
      // console.log("Current volume level:", maxVolume);
  
      if (maxVolume < silenceThreshold) {
        if (silenceStart.current === null) {
          silenceStart.current = Date.now();
        } else if (Date.now() - silenceStart.current > silenceDuration) {
          console.log("Silence detected. Stopping listening...");
          stopListening();
          silenceStart.current = null;
        }
      } else {
        silenceStart.current = null;
      }
  
      animationFrameId = requestAnimationFrame(checkSilence);
    }
  
    console.log("Starting silence detection...");
    checkSilence(); // Start detection
  
    return () => {
      console.log("Cleaning up: Disconnecting LiveKit & stopping silence detection...");
      
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId); // ✅ Cancel any pending frame
      }
  
      audioContext.close(); // ✅ Close audio processing
    };
  }, [audioTrack]);
      
  async function stopListening() {
    console.log("Auto-stopping due to silence, the state was:", state);

    if (room) {
      room.disconnect(true); // ✅ Properly disconnects LiveKit session
      console.log("LiveKit assistant disconnected.");
    } else {
      console.warn("No LiveKit room instance found. Cannot disconnect.");
    }
  }
  
  
  return (
    <div className="h-[300px] max-w-[90vw] mx-auto">
      <div style={{ marginTop: '10px', textAlign: 'center' }}>
        Autolife AI Assistant
      </div>
      <div style={{ marginTop: '10px', textAlign: 'center', fontStyle: 'italic', color: 'grey' }}>
        I speak English, Μιλάω ελληνικά, Я говорю по-русски, Je parle français, Ich spreche Deutsch.
      </div>
      <BarVisualizer state={state} barCount={5} trackRef={audioTrack} className="agent-visualizer" options={{ minHeight: 24 }} />
      <div style={{ textAlign: "center", color: "gray" }}>{state}</div>
    </div>
  );
}

function ControlBar(props: {
  onConnectButtonClicked: () => void;
  agentState: AgentState;
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
    <div className="relative h-[100px]">
      <AnimatePresence>
        {props.agentState === "disconnected" && (
          <motion.button
            initial={{ opacity: 0, top: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, top: "-10px" }}
            transition={{ duration: 1, ease: [0.09, 1.04, 0.245, 1.055] }}
            className="uppercase absolute left-1/2 -translate-x-1/2 px-4 py-2 bg-white text-black rounded-md"
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
              initial={{ opacity: 0, top: "10px" }}
              animate={{ opacity: 1, top: 0 }}
              exit={{ opacity: 0, top: "-10px" }}
              transition={{ duration: 0.4, ease: [0.09, 1.04, 0.245, 1.055] }}
              className="flex h-8 absolute left-1/2 -translate-x-1/2  justify-center"
            >
              <VoiceAssistantControlBar controls={{ leave: false }} />
              <DisconnectButton>
                <CloseIcon />
              </DisconnectButton>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}

function onDeviceFailure(error?: MediaDeviceFailure) {
  console.error(error);
  alert(
    "Error acquiring camera or microphone permissions. Please make sure you grant the necessary permissions in your browser and reload the tab"
  );
}
