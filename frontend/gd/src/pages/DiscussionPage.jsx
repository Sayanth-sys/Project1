import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const initialParticipants = [
  { name: "Agent 1", role: "Analytical Thinker", status: "waiting" },
  { name: "Agent 2", role: "Creative Strategist", status: "waiting" },
  { name: "Agent 3", role: "Pragmatic Advisor", status: "waiting" },
  { name: "Agent 4", role: "Innovation Expert", status: "waiting" }
];

function DiscussionPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const topic = location.state?.topic || "AI Ethics and Governance";

  const [participants, setParticipants] = useState([
    ...initialParticipants,
    { name: "You", role: "Human Participant", status: "waiting" }
  ]);
  const [simId, setSimId] = useState(null);
  const [round, setRound] = useState(0);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isHumanTurn, setIsHumanTurn] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [systemStatus, setSystemStatus] = useState(null);

  // INTERRUPT SYSTEM STATE
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [interruptReserved, setInterruptReserved] = useState(false);
  const [isHumanSpeaking, setIsHumanSpeaking] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [interruptCount, setInterruptCount] = useState(0);
  const [humanCanSpeak, setHumanCanSpeak] = useState(false);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textInputRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceThresholdRef = useRef(5000);
  const lastSoundTimeRef = useRef(null);
  const animationFrameRef = useRef(null);

  // EVENT QUEUE SYSTEM
  const eventQueueRef = useRef([]);
  const processingQueueRef = useRef(false);
  const participantsRef = useRef(participants);

  // ─────────────────────────────────────────────────────────────────────────────
  // THE FIX: Two refs that mirror the corresponding state variables.
  //
  // Problem: `reserveInterrupt` and `fetchNextRound`'s SSE loop are async
  // functions. React state updates are batched and async, so by the time
  // `isAgentSpeaking` state is read inside these functions it may be stale
  // (still showing the value from the previous render).
  //
  // Additionally, `processQueue` blocks on audio playback (await Promise).
  // While it is waiting, newly-arrived `agent_speaking` SSE events sit in the
  // queue unprocessed. If we only set isAgentSpeaking inside processQueue the
  // button stays grey until the queue drains — which can be the full length of
  // the previous agent's audio clip.
  //
  // Solution:
  //   1. Keep `isAgentSpeakingRef` and `interruptReservedRef` in sync with
  //      their state counterparts via wrapper setters.
  //   2. In `fetchNextRound`'s SSE reader, set isAgentSpeaking TRUE immediately
  //      when `agent_speaking` arrives — OUTSIDE the queue — so the button
  //      activates the instant the backend sends the event.
  //   3. `reserveInterrupt` reads from the ref (always current) instead of
  //      the potentially-stale state.
  // ─────────────────────────────────────────────────────────────────────────────
  const isAgentSpeakingRef = useRef(false);
  const setIsAgentSpeakingBoth = (val) => {
    isAgentSpeakingRef.current = val;
    setIsAgentSpeaking(val);
  };

  const interruptReservedRef = useRef(false);
  const setInterruptReservedBoth = (val) => {
    interruptReservedRef.current = val;
    setInterruptReserved(val);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => { checkSystemHealth(); }, []);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingDuration(0);
    }
    return () => { if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); };
  }, [isRecording]);

  useEffect(() => { participantsRef.current = participants; }, [participants]);

  const checkSystemHealth = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8001/health");
      const data = await res.json();
      setSystemStatus(data);
    } catch (err) {
      console.error("❌ Could not check system health:", err);
    }
  };

  const endDiscussion = async () => {
    if (!simId) { navigate('/home'); return; }
    try {
      const response = await fetch(`http://127.0.0.1:8001/end_discussion/${simId}`, { method: "POST" });
      const result = await response.json();
      if (result && !result.error) {
        const feedbackStore = JSON.parse(localStorage.getItem("discussionFeedback") || "{}");
        feedbackStore[simId] = { ...result, topic };
        localStorage.setItem("discussionFeedback", JSON.stringify(feedbackStore));
        navigate(`/feedback/${simId}`);
      } else {
        alert("Could not generate feedback. " + (result.error || ""));
        navigate('/home');
      }
    } catch (err) {
      alert("Failed to end discussion.");
      navigate('/home');
    }
  };

  const startSimulation = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8001/start_simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, num_agents: 4, rounds: 2, human_participant: true })
      });
      const data = await res.json();
      setSimId(data.simulation_id);
      if (data.agents) {
        setParticipants(prev => {
          const updated = [...prev];
          data.agents.forEach((agent, i) => {
            updated[i] = { ...updated[i], name: agent.name, role: agent.persona };
          });
          return updated;
        });
      }
    } catch (err) {
      alert("Failed to start simulation");
    }
    setLoading(false);
  };

  // RESERVE INTERRUPT
  // Reads from refs so the check is always against the live value,
  // not a potentially-stale React state snapshot.
  const reserveInterrupt = async () => {
    if (!simId || interruptReservedRef.current || !isAgentSpeakingRef.current) {
      console.warn("Cannot interrupt right now — agent not speaking or already reserved");
      return;
    }
    try {
      const res = await fetch(`http://127.0.0.1:8001/reserve_interrupt/${simId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.success) {
        setInterruptReservedBoth(true);
        setInterruptCount(data.interrupt_count || 1);
        console.log(`🔔 Interrupt #${data.interrupt_count} reserved!`);
      }
    } catch (error) {
      console.error("❌ Error reserving interrupt:", error);
    }
  };

  const setupAudioContext = async (stream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;
      lastSoundTimeRef.current = Date.now();

      const monitorSilence = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        if (average > 30) lastSoundTimeRef.current = Date.now();
        const silenceDuration = Date.now() - lastSoundTimeRef.current;
        if (silenceDuration > silenceThresholdRef.current) {
          console.log("🔇 Silence detected — stopping recording");
          stopRecording();
          return;
        }
        animationFrameRef.current = requestAnimationFrame(monitorSilence);
      };
      monitorSilence();
    } catch (error) {
      console.warn("⚠️ Could not setup audio context:", error);
    }
  };

  const startRecording = async () => {
    if (systemStatus && (!systemStatus.whisper_loaded || !systemStatus.ffmpeg_available)) {
      alert("Voice recording not available. Please use text input instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      audioStreamRef.current = stream;
      await setupAudioContext(stream);

      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : { mimeType: 'audio/webm' };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        if (audioBlob.size > 1000) {
          await submitVoice(audioBlob);
        } else {
          alert("Recording too short. Please try again or use text input.");
          setIsProcessing(false);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsHumanSpeaking(true);
    } catch (error) {
      alert(`Could not access microphone: ${error.message}\n\nUse text input instead.`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsHumanSpeaking(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(t => t.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const submitVoice = async (audioBlob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    try {
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`, agent: 'System',
        text: '⏳ Transcribing your audio...', isSystem: true
      }]);
      const response = await fetch(`http://127.0.0.1:8001/submit_human_input/${simId}`, {
        method: 'POST', body: formData
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      if (data.success) {
        setMessages(prev => {
          const filtered = prev.filter(m => !(m.isSystem && m.text.includes('Transcribing')));
          return [...filtered, {
            id: `msg-${Date.now()}`, agent: 'You', role: 'Human Participant',
            text: data.transcribed_text, isHuman: true, isThinking: false
          }];
        });
        setParticipants(prev => prev.map(p => p.name === 'You' ? { ...p, status: 'spoke' } : p));
        setIsHumanTurn(false);
        setIsHumanSpeaking(false);
        setHumanCanSpeak(false);
      } else {
        setMessages(prev => prev.filter(m => !(m.isSystem && m.text.includes('Transcribing'))));
        alert(`❌ Audio failed:\n\n${data.error}`);
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => !(m.isSystem && m.text.includes('Transcribing'))));
      alert(`❌ Failed to submit audio:\n\n${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitText = async () => {
    if (!textInput.trim()) return;
    setIsProcessing(true);
    const textToSubmit = textInput;
    try {
      const response = await fetch(
        `http://127.0.0.1:8001/submit_human_input/${simId}?text=${encodeURIComponent(textToSubmit)}`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}`, agent: 'You', role: 'Human Participant',
          text: textToSubmit, isHuman: true, isThinking: false
        }]);
        setParticipants(prev => prev.map(p => p.name === 'You' ? { ...p, status: 'spoke' } : p));
        setTextInput('');
        setIsHumanTurn(false);
        setIsHumanSpeaking(false);
        setHumanCanSpeak(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to submit text');
    } finally {
      setIsProcessing(false);
    }
  };

  // PROCESS QUEUE SEQUENTIALLY — awaits audio before moving to next event.
  // Note: isAgentSpeaking is NOT set here for agent_speaking events because
  // it is already set immediately in fetchNextRound's SSE reader (see below).
  const processQueue = async () => {
    if (processingQueueRef.current || eventQueueRef.current.length === 0) return;
    processingQueueRef.current = true;

    while (eventQueueRef.current.length > 0) {
      const data = eventQueueRef.current.shift();
      console.log("📨 Processing queued event:", data.type);

      try {
        if (data.type === 'agent_speaking') {
          // Fire isAgentSpeakingBoth(true) when the event is PROCESSED, so the button activates precisely when the audio starts/agent's turn begins.
          setIsAgentSpeakingBoth(true);
          setCurrentSpeaker(data.agent);
          setParticipants(prev =>
            prev.map(p =>
              p.name === data.agent
                ? { ...p, status: 'speaking' }
                : { ...p, status: p.status === 'spoke' ? 'spoke' : 'waiting' }
            )
          );
        }

        else if (data.type === 'human_start') {
          // Clear agent speaking state — it's the human's turn now
          setIsAgentSpeakingBoth(false);
          setInterruptReservedBoth(false);
          setIsHumanTurn(true);
          setHumanCanSpeak(true);
          setCurrentSpeaker('You');
          setParticipants(prev =>
            prev.map(p =>
              p.name === 'You' ? { ...p, status: 'thinking' } : { ...p, status: 'waiting' }
            )
          );
          setMessages(prev => [...prev, {
            id: `system-${Date.now()}`, agent: 'System',
            text: '🎤 Your turn! Recording started — speak now. Press "Done Speaking" or wait 5s of silence to finish.',
            isSystem: true
          }]);
          setTimeout(() => startRecording(), 500);
        }

        else if (data.type === 'human_response') {
          // Backend echoed the human utterance. We already display it locally
          // in submitVoice/submitText, so just update the sidebar status.
          setParticipants(prev =>
            prev.map(p => p.name === 'You' ? { ...p, status: 'spoke' } : p)
          );
          setIsHumanTurn(false);
          setIsHumanSpeaking(false);
          setHumanCanSpeak(false);
        }

        else if (data.type === 'response') {
          setParticipants(prev =>
            prev.map(p => p.name === data.agent ? { ...p, status: 'speaking' } : p)
          );
          setMessages(prev => {
            const filtered = prev.filter(m => !(m.agent === data.agent && m.isThinking));
            return [...filtered, {
              id: `msg-${Date.now()}`,
              agent: data.agent,
              role: participantsRef.current.find(p => p.name === data.agent)?.role || '',
              text: data.text,
              isThinking: false
            }];
          });

          // Await audio completion before processing the next queued event.
          // This is what keeps one agent's audio from overlapping the next.
          if (data.audio) {
            await new Promise((resolve) => {
              const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
              const onFinish = () => {
                // Audio clip ended, clear the speaking flag so the button disables briefly before the next agent, OR passes to human
                setIsAgentSpeakingBoth(false);
                setParticipants(prev =>
                  prev.map(p => p.name === data.agent ? { ...p, status: 'spoke' } : p)
                );
                resolve();
              };
              audio.onended = onFinish;
              audio.onerror = onFinish;
              audio.play().catch(onFinish);
            });
          } else {
            setIsAgentSpeakingBoth(false);
            setParticipants(prev =>
              prev.map(p => p.name === data.agent ? { ...p, status: 'spoke' } : p)
            );
          }
        }

        else if (data.type === 'complete') {
          setRound(data.round);
          setIsAgentSpeakingBoth(false);
          setParticipants(prev => prev.map(p => ({ ...p, status: 'waiting' })));
          setLoading(false);
        }

      } catch (e) {
        console.error("❌ Error processing queued event:", e);
      }
    }

    processingQueueRef.current = false;
  };

  const fetchNextRound = async () => {
    if (!simId) return alert("Start simulation first!");

    eventQueueRef.current = [];
    processingQueueRef.current = false;
    setIsAgentSpeakingBoth(false);
    setInterruptReservedBoth(false);
    setLoading(true);

    try {
      const response = await fetch(`http://127.0.0.1:8001/next_round/${simId}`, { method: "POST" });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6).trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              console.log("📨 SSE received:", data.type);

              // Note: isAgentSpeaking state is now properly synchronized within processQueue
              // so the button disables and activates perfectly with audio playback.

              // All events go into the queue for ordered processing
              eventQueueRef.current.push(data);
              processQueue();

            } catch (e) {
              console.error("❌ Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (err) {
      console.error("❌ Error fetching next round:", err);
      alert("Failed to fetch next round");
    }
    setLoading(false);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // INTERRUPT BUTTON DERIVED STATE
  const interruptButtonDisabled = !isAgentSpeaking || interruptReserved || isHumanSpeaking || !simId;
  const interruptButtonLabel =
    isHumanSpeaking   ? "🎤 You're speaking..." :
    interruptReserved ? `✓ Next chance reserved` :
    isAgentSpeaking   ? "🔔 Reserve Next Turn" :
                        "Waiting...";

  const warningBannerVisible = systemStatus && (!systemStatus.whisper_loaded || !systemStatus.ffmpeg_available);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f5f5f5' }}>

      {warningBannerVisible && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: '#fff3cd', color: '#856404',
          padding: '10px 20px', textAlign: 'center', fontSize: '14px',
          zIndex: 1000, borderBottom: '2px solid #ffc107'
        }}>
          ⚠️ Voice input unavailable — use text input instead
        </div>
      )}

      {/* Participants Sidebar */}
      <div style={{ width: '300px', background: 'white', borderRight: '1px solid #e0e0e0', overflowY: 'auto', marginTop: warningBannerVisible ? '42px' : '0' }}>
        <div style={{ padding: '20px', borderBottom: '2px solid #e0e0e0', fontWeight: 'bold', fontSize: '18px' }}>
          Participants
        </div>
        {participants.map((p) => (
          <div key={p.name} style={{
            padding: '15px', borderBottom: '1px solid #f0f0f0',
            background:
              p.status === 'thinking' ? '#fff3cd' :
              p.status === 'speaking' ? '#cce5ff' :
              p.status === 'spoke'    ? '#d4edda' : 'white',
            transition: 'background 0.3s'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: p.name === 'You'
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px'
            }}>
              {p.name === 'You' ? '👤' : '🤖'}
            </div>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{p.name}</div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{p.role}</div>
            <div style={{
              fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
              color:
                p.status === 'thinking' ? '#856404' :
                p.status === 'speaking' ? '#004085' :
                p.status === 'spoke'    ? '#155724' : '#999'
            }}>
              {p.status === 'thinking' ? '💭 Thinking...' :
               p.status === 'speaking' ? '🗣️ Speaking...' :
               p.status === 'spoke'    ? '✓ Just spoke' : 'Waiting'}
            </div>
          </div>
        ))}
      </div>

      {/* Main Discussion */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: warningBannerVisible ? '42px' : '0' }}>

        {/* Header */}
        <div style={{ background: 'white', padding: '20px', borderBottom: '1px solid #e0e0e0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>Round {round}</div>
              <div style={{ color: '#666' }}>Topic: <strong>{topic}</strong></div>
            </div>
            <button onClick={endDiscussion} style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              End Discussion
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={startSimulation} disabled={loading || simId !== null} style={{
              padding: '10px 20px', background: simId ? '#28a745' : '#007bff', color: 'white',
              border: 'none', borderRadius: '5px', cursor: simId ? 'not-allowed' : 'pointer',
              opacity: (loading && !simId) || simId ? 0.7 : 1
            }}>
              {loading && !simId ? "Starting..." : simId ? "✓ Started" : "Start Simulation"}
            </button>
            <button onClick={fetchNextRound} disabled={!simId || loading} style={{
              padding: '10px 20px', background: '#17a2b8', color: 'white', border: 'none',
              borderRadius: '5px', cursor: !simId || loading ? 'not-allowed' : 'pointer',
              opacity: !simId || loading ? 0.5 : 1
            }}>
              {loading ? "⏳ In Progress..." : "Next Round"}
            </button>

            {/* INTERRUPT BUTTON
                - Grey + "Waiting..."      : no agent speaking
                - Red + "Reserve Next Turn": agent speaking, can click
                - Yellow + "✓ Next chance" : already reserved, inactive
                - Grey + "You're speaking" : human's turn, inactive        */}
            <button
              onClick={reserveInterrupt}
              disabled={interruptButtonDisabled}
              style={{
                padding: '10px 20px',
                background:
                  isHumanSpeaking   ? '#6c757d' :
                  interruptReserved ? '#ffc107' :
                  isAgentSpeaking   ? '#dc3545' : '#6c757d',
                color: interruptReserved ? '#333' : 'white',
                border: 'none', borderRadius: '5px',
                cursor: interruptButtonDisabled ? 'not-allowed' : 'pointer',
                opacity: (!isAgentSpeaking && !interruptReserved && !isHumanSpeaking) ? 0.5 : 1,
                fontWeight: 'bold', transition: 'all 0.3s'
              }}
            >
              {interruptButtonLabel}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#f9f9f9' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', marginTop: '40px', fontSize: '16px' }}>
              Start the simulation and click "Next Round" to begin
              <br /><br />
              💡 You'll get a chance to speak in each round!
              <br />
              🔔 Click "Reserve Next Turn" while an agent is speaking to jump in next!
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} style={{
                background:
                  msg.isHuman  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' :
                  msg.isSystem ? '#e8f4f8' : 'white',
                color: msg.isHuman ? 'white' : '#333',
                padding: '15px', borderRadius: '10px', marginBottom: '12px',
                border: msg.isSystem ? '2px solid #b3e5fc' : 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
                  {msg.agent}{msg.role && ` • ${msg.role}`}
                </div>
                {msg.isThinking ? (
                  <div style={{ fontStyle: 'italic', opacity: 0.8 }}>💭 Thinking...</div>
                ) : (
                  <div style={{ fontSize: '15px', lineHeight: '1.5' }}>{msg.text}</div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ background: 'white', borderTop: '1px solid #e0e0e0', padding: '20px', display: 'flex', gap: '10px' }}>

          {/* "You can talk now" state — recording auto-started */}
          {humanCanSpeak && isRecording && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '15px',
              background: '#fff3cd', padding: '15px', borderRadius: '5px', border: '2px solid #ffc107'
            }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dc3545', animation: 'pulse 1s infinite' }} />
              <span style={{ fontWeight: 'bold', color: '#856404', flex: 1 }}>
                🎤 You can talk now. Recording: {formatDuration(recordingDuration)}
                <span style={{ fontWeight: 'normal', fontSize: '13px', marginLeft: '8px' }}>(auto-stops after 5s silence)</span>
              </span>
              <button onClick={stopRecording} style={{
                padding: '8px 16px', background: '#dc3545', color: 'white',
                border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap'
              }}>
                ⏹️ Done Speaking
              </button>
            </div>
          )}

          {/* Human's turn but recording not yet started — show text + manual record */}
          {isHumanTurn && !humanCanSpeak && !isRecording && !isProcessing && (
            <>
              <input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && submitText()}
                placeholder="Type your response or use the 🎤 Record button..."
                style={{ flex: 1, padding: '12px', border: '2px solid #667eea', borderRadius: '5px', fontSize: '14px' }}
              />
              <button onClick={submitText} disabled={!textInput.trim()} style={{
                padding: '10px 20px', background: '#28a745', color: 'white',
                border: 'none', borderRadius: '5px',
                cursor: !textInput.trim() ? 'not-allowed' : 'pointer',
                opacity: !textInput.trim() ? 0.5 : 1
              }}>
                Send
              </button>
              <button onClick={startRecording} style={{
                padding: '10px 20px', background: '#dc3545', color: 'white',
                border: 'none', borderRadius: '5px', cursor: 'pointer'
              }}>
                🎤 Record
              </button>
            </>
          )}

          {/* Manual recording (not triggered by interrupt) */}
          {isRecording && !humanCanSpeak && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '15px',
              background: '#fff3cd', padding: '15px', borderRadius: '5px', border: '2px solid #ffc107'
            }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#dc3545', animation: 'pulse 1s infinite' }} />
              <span style={{ fontWeight: 'bold', color: '#856404' }}>
                🎤 You can talk now. Recording: {formatDuration(recordingDuration)}
              </span>
              <button onClick={stopRecording} style={{
                marginLeft: 'auto', padding: '8px 16px', background: '#dc3545',
                color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold'
              }}>
                ⏹️ Done Speaking
              </button>
            </div>
          )}

          {isProcessing && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
              padding: '15px', background: '#e8f4f8', borderRadius: '5px'
            }}>
              <div style={{ width: '16px', height: '16px', border: '3px solid #ccc', borderTopColor: '#17a2b8', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <span style={{ color: '#0c5460', fontWeight: 'bold' }}>Processing your input...</span>
            </div>
          )}

          {!isHumanTurn && !humanCanSpeak && !isRecording && !isProcessing && (
            <div style={{
              flex: 1, padding: '15px', background: '#d4edda',
              borderRadius: '5px', color: '#155724', textAlign: 'center', fontWeight: 'bold'
            }}>
              {interruptReserved
                ? "✓ Your spot is reserved — waiting for current agent to finish..."
                : "Waiting for agents to speak..."}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default DiscussionPage;