"use client";

/**
 * Retell Call Client Component
 * Isolated to avoid webpack bundling issues with the Retell SDK
 */

import { useEffect, useRef, useCallback, useState } from "react";

interface RetellCallClientProps {
  accessToken: string;
  onCallStarted: () => void;
  onCallEnded: () => void;
  onError: (error: string) => void;
  onMuteChange?: (muted: boolean) => void;
}

export function RetellCallClient({
  accessToken,
  onCallStarted,
  onCallEnded,
  onError,
}: RetellCallClientProps) {
  const retellClientRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const initializeAndStart = useCallback(async () => {
    try {
      // Dynamic import at runtime
      const RetellModule = await import("retell-client-js-sdk");
      const RetellWebClient = RetellModule.RetellWebClient;

      const client = new RetellWebClient();
      retellClientRef.current = client;

      client.on("call_started", () => {
        setIsInitialized(true);
        onCallStarted();
      });

      client.on("call_ended", () => {
        onCallEnded();
      });

      client.on("error", () => {
        onError("Call error occurred. Please try again.");
      });

      await client.startCall({
        accessToken,
        sampleRate: 24000,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to initialize call");
    }
  }, [accessToken, onCallStarted, onCallEnded, onError]);

  useEffect(() => {
    initializeAndStart();

    return () => {
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [initializeAndStart]);

  const handleEndCall = () => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
  };

  const handleToggleMute = () => {
    if (retellClientRef.current) {
      if (isMuted) {
        retellClientRef.current.unmute();
      } else {
        retellClientRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  return { isInitialized, isMuted, handleEndCall, handleToggleMute };
}

// Export a hook version for easier use
export function useRetellCall(
  accessToken: string | null,
  callbacks: {
    onCallStarted: () => void;
    onCallEnded: () => void;
    onError: (error: string) => void;
  }
) {
  const retellClientRef = useRef<any>(null);
  const [isMuted, setIsMuted] = useState(false);

  const startCall = useCallback(async () => {
    if (!accessToken) return;

    try {
      const RetellModule = await import("retell-client-js-sdk");
      const RetellWebClient = RetellModule.RetellWebClient;

      const client = new RetellWebClient();
      retellClientRef.current = client;

      client.on("call_started", callbacks.onCallStarted);
      client.on("call_ended", callbacks.onCallEnded);
      client.on("error", () => callbacks.onError("Call error occurred. Please try again."));

      await client.startCall({
        accessToken,
        sampleRate: 24000,
      });
    } catch (err) {
      callbacks.onError(err instanceof Error ? err.message : "Failed to initialize call");
    }
  }, [accessToken, callbacks]);

  const endCall = useCallback(() => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (retellClientRef.current) {
      if (isMuted) {
        retellClientRef.current.unmute();
      } else {
        retellClientRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  return { startCall, endCall, toggleMute, isMuted };
}
