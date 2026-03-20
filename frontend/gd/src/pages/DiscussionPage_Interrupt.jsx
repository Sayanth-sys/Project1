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
  
  // Get topic from location state (passed from TopicSelection)
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
  
  // ✅ INTERRUPT SYSTEM STATE
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [interruptReserved, setInterruptReserved] = useState(false);
  const [isHumanSpeaking, setIsHumanSpeaking] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [interruptStatus, setInterruptStatus] = useState("");
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textInputRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const silenceThresholdRef = useRef(3000); // 3 seconds of silence
  const lastSoundTimeRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    checkSystemHealth();
  }, []);

  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingDuration(0);
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const checkSystemHealth = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8001/health");
      const data = await res.json();
      setSystemStatus(data);
      console.log("🏥 System health:", data);
      
      if (!data.whisper_loaded) {
        console.warn("⚠️ Whisper not loaded - voice input unavailable");
      }
      if (!data.ffmpeg_available) {
        console.warn("⚠️ FFmpeg not available - voice input unavailable");
      }
    } catch (err) {
      console.error("❌ Could not check system health:", err);
    }
  };

  const startSimulation = async () => {
    setLoading(true);
    try {
      console.log("🎯 Starting simulation with topic:", topic);
      const res = await fetch("http://127.0.0.1:8001/start_simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic: topic,
          num_agents: 4, 
          rounds: 2,
          human_participant: true 
        })
      });
      const data = await res.json();
      setSimId(data.simulation_id);
      
      if (data.agents) {
        setParticipants(prev => {
          const updated = [...prev];
          data.agents.forEach((agent, i) => {
            updated[i] = {
              ...updated[i],
              name: agent.name,
              role: agent.persona
            };
          });
          return updated;
        });
      }
      
      console.log("✅ Simulation started:", data.simulation_id);
    } catch (err) {
      console.error("❌ Error starting simulation:", err);
      alert("Failed to start simulation");
    }
    setLoading(false);
  };

  // ✅ RESERVE INTERRUPT
  const reserveInterrupt = async () => {
    if (!simId || interruptReserved || !isAgentSpeaking) {
      console.warn("Cannot interrupt right now");
      return;
    }

    try {
      console.log("🔔 Requesting interrupt for:", currentSpeaker);
      const res = await fetch(`http://127.0.0.1:8001/reserve_interrupt/${simId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      const data = await res.json();
      console.log("✅ Interrupt response:", data);
      
      if (data.success) {
        setInterruptReserved(true);
        setInterruptStatus("Next chance reserved");
        console.log(`🔔 Interrupt #${data.interrupt_count} reserved!`);
      } else {
        console.error("❌ Could not reserve interrupt:", data);
      }
    } catch (error) {
      console.error("❌ Error reserving interrupt:", error);
    }
  };

  // ✅ START AUDIO CONTEXT FOR SILENCE DETECTION
  const setupAudioContext = async (stream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const source = audioContextRef.current.createMediaStreamAudioProcessor(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      
      source.connect(analyser);
      analyserRef.current = analyser;
      lastSoundTimeRef.current = Date.now();
      
      // Start monitoring silence
      const monitorSilence = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        
        // If audio level is above threshold, update last sound time
        if (average > 30) {
          lastSoundTimeRef.current = Date.now();
        }
        
        // Check if silence has lasted 3 seconds
        const silenceDuration = Date.now() - lastSoundTimeRef.current;
        if (silenceDuration > silenceThresholdRef.current && isRecording) {
          console.log("🔇 Silence detected after 3 seconds - stopping recording");
          stopRecording();
          return;
        }
        
        animationFrameRef.current = requestAnimationFrame(monitorSilence);
      };
      
      monitorSilence();
    } catch (error) {
      console.warn("⚠️ Could not setup audio context for silence detection:", error);
      // Continue without silence detection
    }
  };

  const startRecording = async () => {
    if (
      systemStatus &&
      (!systemStatus.whisper_loaded || !systemStatus.ffmpeg_available)
    ) {
      alert(
        "Voice recording is not available. Missing:\n" +
        (!systemStatus.whisper_loaded ? "- Whisper model\n" : "") +
        (!systemStatus.ffmpeg_available ? "- FFmpeg\n" : "") +
        "\nPlease use text input instead."
      );
      return;
    }
    try {
      console.log("🎤 Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      audioStreamRef.current = stream;
      console.log("✅ Microphone access granted");

      // Setup audio context for silence detection
      await setupAudioContext(stream);

      const options = { mimeType: 'audio/webm;codecs=opus' };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.warn("⚠️ Opus not supported, trying default webm");
        options.mimeType = 'audio/webm';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(`📦 Audio chunk received: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log(`🛑 Recording stopped. Total chunks: ${audioChunksRef.current.length}`);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        console.log(`📊 Audio blob size: ${audioBlob.size} bytes`);
        
        stream.getTracks().forEach(track => {
          track.stop();
          console.log("🔇 Stopped audio track");
        });
        
        if (audioBlob.size > 1000) {
          await submitVoice(audioBlob);
        } else {
          console.error("❌ Recording too short or empty");
          alert("Recording failed - audio file is too small. Please try again or use text input.");
          setIsProcessing(false);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("❌ MediaRecorder error:", event.error);
        alert("Recording error: " + event.error);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsHumanSpeaking(true);
      console.log("🔴 Recording started with format:", options.mimeType);
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      alert(`Could not access microphone: ${error.message}\n\nPlease check:\n1. Microphone permissions\n2. Microphone is connected\n3. No other app is using the microphone\n\nUse text input instead.`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("⏹️ Stopping recording...");
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop audio context monitoring
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const submitVoice = async (audioBlob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      console.log(`📤 Submitting ${audioBlob.size} bytes audio to backend...`);
      const response = await fetch(`http://127.0.0.1:8001/submit_human_input/${simId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Server response:', data);
      
      if (data.success) {
        console.log(`💬 Transcribed: "${data.transcribed_text}"`);
        setIsHumanTurn(false);
        setIsHumanSpeaking(false);
      } else {
        console.error("❌ Transcription failed:", data.error);
        alert(`Could not transcribe audio:\n${data.error}\n\nPlease try:\n1. Speaking louder and clearer\n2. Reducing background noise\n3. Using text input instead`);
      }
    } catch (error) {
      console.error('❌ Error submitting audio:', error);
      alert(`Failed to submit audio: ${error.message}\n\nPlease use text input instead.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const submitText = async () => {
    if (!textInput.trim()) return;
    
    setIsProcessing(true);
    try {
      console.log(`📤 Submitting text: "${textInput}"`);
      const response = await fetch(`http://127.0.0.1:8001/submit_human_input/${simId}?text=${encodeURIComponent(textInput)}`, {
        method: 'POST',
      });

      const data = await response.json();
      console.log('✅ Server response:', data);
      
      if (data.success) {
        console.log(`💬 Human typed: "${data.transcribed_text}"`);
        setTextInput('');
        setIsHumanTurn(false);
        setIsHumanSpeaking(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Error submitting text:', error);
      alert('Failed to submit text');
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchNextRound = async () => {
    if (!simId) return alert("Start simulation first!");
    setLoading(true);
    setInterruptReserved(false); // Reset interrupt flag for new round
    setInterruptStatus("");
    
    try {
      const response = await fetch(`http://127.0.0.1:8001/next_round/${simId}`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
              console.log("📨 Received:", data);
              
              // ✅ HANDLE NEW EVENT: agent_speaking
              if (data.type === 'agent_speaking') {
                console.log(`🗣️ ${data.agent} is now speaking`);
                setCurrentSpeaker(data.agent);
                setIsAgentSpeaking(true);
                
                setParticipants(prev =>
                  prev.map(p =>
                    p.name === data.agent
                      ? { ...p, status: 'speaking' }
                      : { ...p, status: 'waiting' }
                  )
                );
              }
              
              // ✅ HANDLE NEW EVENT: interrupt_reserved (confirmation)
              else if (data.type === 'interrupt_reserved') {
                console.log("✅ Interrupt confirmed by server");
                setInterruptReserved(true);
              }
              
              // ✅ HANDLE NEW EVENT: human_start (auto-record)
              else if (data.type === 'human_start') {
                console.log('🎤 Human turn triggered! Starting recording...');
                setIsAgentSpeaking(false);
                setIsHumanTurn(true);
                setCurrentSpeaker('You');
                setParticipants(prev =>
                  prev.map(p =>
                    p.name === 'You'
                      ? { ...p, status: 'thinking' }
                      : { ...p, status: 'waiting' }
                  )
                );
                
                // Auto-start recording
                setTimeout(() => {
                  startRecording();
                }, 500);
              }
              
              // ✅ HANDLE NEW EVENT: recording_started
              else if (data.type === 'recording_started') {
                console.log("🔴 Recording signal received:", data.message);
                setMessages(prev => [...prev, {
                  id: `system-${Date.now()}`,
                  agent: 'System',
                  text: data.message,
                  isSystem: true
                }]);
              }

              else if (data.type === 'human_response') {
                setMessages(prev => [...prev, {
                  id: `msg-${Date.now()}`,
                  agent: 'You',
                  role: 'Human Participant',
                  text: data.text,
                  isThinking: false,
                  isHuman: true
                }]);

                setParticipants(prev =>
                  prev.map(p =>
                    p.name === 'You'
                      ? { ...p, status: 'spoke' }
                      : p
                  )
                );
                setLoading(true);
              }

              else if (data.type === 'response') {
                setIsAgentSpeaking(false);
                setParticipants(prev =>
                  prev.map(p =>
                    p.name === data.agent
                      ? { ...p, status: 'speaking' }
                      : p
                  )
                );

                setMessages(prev => {
                  const filtered = prev.filter(m => !(m.agent === data.agent && m.isThinking));
                  return [...filtered, {
                    id: `msg-${Date.now()}`,
                    agent: data.agent,
                    role: participants.find(p => p.name === data.agent)?.role || '',
                    text: data.text,
                    isThinking: false
                  }];
                });

                if (data.audio) {
                  const playAudio = () => {
                    return new Promise((resolve) => {
                      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                      audio.onended = resolve;
                      audio.onerror = () => {
                        console.warn("Audio play error");
                        resolve();
                      };
                      audio.play().catch(err => {
                        console.warn("Could not play audio:", err);
                        resolve();
                      });
                    });
                  };
                  
                  playAudio().then(() => {
                    setParticipants(prev =>
                      prev.map(p =>
                        p.name === data.agent
                          ? { ...p, status: 'spoke' }
                          : p
                      )
                    );
                  });
                }
              }

              else if (data.type === 'complete') {
                setRound(data.round);
                setIsAgentSpeaking(false);
                setParticipants(prev =>
                  prev.map(p => ({ ...p, status: 'waiting' }))
                );
                setLoading(false);
              }
              
            } catch (e) {
              console.error("❌ Error parsing SSE data:", e);
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

  // ✅ INTERRUPT BUTTON ENABLED/DISABLED LOGIC
  const interruptButtonDisabled = !isAgentSpeaking || interruptReserved || isHumanSpeaking || !simId;
  const interruptButtonText = interruptReserved ? "Next chance reserved" : 
                              isHumanSpeaking ? "Speaking..." :
                              isAgentSpeaking ? "Interrupt / Reserve Next Turn" : "Waiting...";

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: '#f5f5f5'
    }}>
      {systemStatus && (!systemStatus.whisper_loaded || !systemStatus.ffmpeg_available) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          background: '#fff3cd',
          color: '#856404',
          padding: '10px 20px',
          textAlign: 'center',
          fontSize: '14px',
          zIndex: 1000,
          borderBottom: '2px solid #ffc107'
        }}>
          ⚠️ Voice input unavailable:
          {!systemStatus.whisper_loaded && ' Whisper model missing'}
          {!systemStatus.whisper_loaded && !systemStatus.ffmpeg_available && ' &'}
          {!systemStatus.ffmpeg_available && ' FFmpeg not found'}
          - Use text input instead
        </div>
      )}

      {/* Participants Sidebar */}
      <div style={{
        width: '300px',
        background: 'white',
        borderRight: '1px solid #e0e0e0',
        overflowY: 'auto',
        marginTop: systemStatus && (!systemStatus.whisper_loaded || !systemStatus.ffmpeg_available) ? '42px' : '0'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '2px solid #e0e0e0',
          fontWeight: 'bold',
          fontSize: '18px'
        }}>
          Participants
        </div>
        {participants.map((p) => (
          <div key={p.name} style={{
            padding: '15px',
            borderBottom: '1px solid #f0f0f0',
            background: p.status === 'thinking' ? '#fff3cd' : 
                       p.status === 'speaking' ? '#cce5ff' :
                       p.status === 'spoke' ? '#d4edda' : 'white',
            transition: 'background 0.3s'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: p.name === 'You' 
                ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px'
            }}>
              {p.name === 'You' ? '👤' : '🤖'}
            </div>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{p.name}</div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{p.role}</div>
            <div style={{ 
              fontSize: '11px', 
              color: p.status === 'thinking' ? '#856404' : 
                     p.status === 'speaking' ? '#004085' :
                     p.status === 'spoke' ? '#155724' : '#999',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {p.status === 'thinking' ? '💭 Thinking...' :
               p.status === 'speaking' ? '🗣️ Speaking...' :
               p.status === 'spoke' ? '✓ Just spoke' : 'Waiting'}
            </div>
          </div>
        ))}
      </div>

      {/* Main Discussion */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        marginTop: systemStatus && (!systemStatus.whisper_loaded || !systemStatus.ffmpeg_available) ? '42px' : '0'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
                Round {round}
              </div>
              <div style={{ color: '#666' }}>
                Topic: <strong>{topic}</strong>
              </div>
            </div>
            <button 
              onClick={() => navigate('/home')}
              style={{
                padding: '10px 20px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              End Discussion
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={startSimulation} 
              disabled={loading || simId !== null}
              style={{
                padding: '10px 20px',
                background: simId ? '#28a745' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: simId ? 'not-allowed' : 'pointer',
                opacity: (loading && !simId) || simId ? 0.7 : 1
              }}
            >
              {loading && !simId ? "Starting..." : simId ? "✓ Started" : "Start Simulation"}
            </button>
            <button 
              onClick={fetchNextRound} 
              disabled={!simId || loading}
              style={{
                padding: '10px 20px',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: !simId || loading ? 'not-allowed' : 'pointer',
                opacity: !simId || loading ? 0.5 : 1
              }}
            >
              {loading ? "⏳ In Progress..." : "Next Round"}
            </button>
            
            {/* ✅ INTERRUPT BUTTON */}
            <button 
              onClick={reserveInterrupt}
              disabled={interruptButtonDisabled}
              style={{
                padding: '10px 20px',
                background: interruptReserved ? '#ffc107' : 
                           isAgentSpeaking ? '#dc3545' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: interruptButtonDisabled ? 'not-allowed' : 'pointer',
                opacity: interruptButtonDisabled ? 0.5 : 1,
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
            >
              🔔 {interruptButtonText}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#f9f9f9'
        }}>
          {messages.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#999',
              marginTop: '40px',
              fontSize: '16px'
            }}>
              Start the simulation and click "Next Round" to begin
              <br /><br />
              💡 You'll get a chance to speak in each round!
              <br />
              🔔 Click the interrupt button during agent speeches!
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} style={{
                background: msg.isHuman ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                           msg.isSystem ? '#e8f4f8' : 'white',
                color: msg.isHuman ? 'white' : '#333',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '12px',
                border: msg.isSystem ? '1px solid #b3e5fc' : 'none',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
                  {msg.agent}
                  {msg.role && ` • ${msg.role}`}
                </div>
                {msg.isThinking ? (
                  <div style={{ fontStyle: 'italic', opacity: 0.8 }}>
                    💭 Thinking...
                  </div>
                ) : (
                  <div style={{ fontSize: '15px', lineHeight: '1.5' }}>
                    {msg.text}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          background: 'white',
          borderTop: '1px solid #e0e0e0',
          padding: '20px',
          display: 'flex',
          gap: '10px'
        }}>
          {isHumanTurn && !isRecording && (
            <>
              <input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && submitText()}
                placeholder="Type your response or record your voice..."
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '5px',
                  fontSize: '14px'
                }}
              />
              <button 
                onClick={submitText}
                disabled={!textInput.trim() || isProcessing}
                style={{
                  padding: '10px 20px',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: !textInput.trim() || isProcessing ? 'not-allowed' : 'pointer',
                  opacity: !textInput.trim() || isProcessing ? 0.5 : 1
                }}
              >
                Send Text
              </button>
              <button 
                onClick={startRecording}
                style={{
                  padding: '10px 20px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                🎤 Record
              </button>
            </>
          )}

          {isRecording && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              background: '#fff3cd',
              padding: '15px',
              borderRadius: '5px',
              border: '2px solid #ffc107'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: '#dc3545',
                animation: 'pulse 1s infinite'
              }}></div>
              <span style={{ fontWeight: 'bold', color: '#856404' }}>
                🎤 Recording: {formatDuration(recordingDuration)}
              </span>
              <button 
                onClick={stopRecording}
                style={{
                  marginLeft: 'auto',
                  padding: '8px 16px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ⏹️ Stop Recording
              </button>
            </div>
          )}

          {isProcessing && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px',
              background: '#e8f4f8',
              borderRadius: '5px'
            }}>
              <div style={{
                width: '16px',
                height: '16px',
                border: '3px solid #ccc',
                borderTopColor: '#17a2b8',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span style={{ color: '#0c5460', fontWeight: 'bold' }}>
                Processing your input...
              </span>
            </div>
          )}

          {!isHumanTurn && !isRecording && !isProcessing && (
            <div style={{
              flex: 1,
              padding: '15px',
              background: '#d4edda',
              borderRadius: '5px',
              color: '#155724',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              Waiting for your turn or agent to finish...
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default DiscussionPage;