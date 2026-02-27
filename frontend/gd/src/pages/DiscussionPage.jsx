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
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textInputRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioStreamRef = useRef(null);

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
          topic: topic,  // Use the topic from location state
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
              
              if (data.type === 'thinking') {
                setParticipants(prev =>
                  prev.map(p =>
                    p.name === data.agent
                      ? { ...p, status: 'thinking' }
                      : { ...p, status: 'waiting' }
                  )
                );

                setMessages(prev => [...prev, {
                  id: `thinking-${Date.now()}`,
                  agent: data.agent,
                  role: participants.find(p => p.name === data.agent)?.role || '',
                  text: '',
                  isThinking: true
                }]);

              } else if (data.type === 'human_turn') {
                console.log('🎤 Your turn to speak!');
                setParticipants(prev =>
                  prev.map(p =>
                    p.name === 'You'
                      ? { ...p, status: 'thinking' }
                      : { ...p, status: 'waiting' }
                  )
                );
                setIsHumanTurn(true);
                setLoading(false);

              } else if (data.type === 'human_response') {
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

              } else if (data.type === 'response') {
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
                  await new Promise((resolve) => {
                    const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
                    audio.onended = resolve;
                    audio.onerror = () => {
                      console.warn("Audio play error");
                      resolve();
                    };
                    audio.play();
                  });
                }

                setParticipants(prev =>
                  prev.map(p =>
                    p.name === data.agent
                      ? { ...p, status: 'spoke' }
                      : p
                  )
                );

              } else if (data.type === 'complete') {
                setRound(data.round);
                setParticipants(prev =>
                  prev.map(p => ({ ...p, status: 'waiting' }))
                );
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
        marginTop: systemStatus && (!systemStatus.whisper_loaded || !systemStatus.ffmpeg_available) ? '42px' : '0'      }}>
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
                       p.status === 'spoke' ? '#d4edda' : 
                       p.status === 'speaking' ? '#cce5ff' : 'white',
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
        marginTop: systemStatus && (!systemStatus.vosk_model_loaded || !systemStatus.ffmpeg_available) ? '42px' : '0'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              
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
          <div style={{ display: 'flex', gap: '10px' }}>
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
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} style={{
                background: msg.isHuman ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'white',
                color: msg.isHuman ? 'white' : '#333',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '15px',
                marginLeft: msg.isHuman ? '40px' : '0',
                marginRight: msg.isHuman ? '0' : '40px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: msg.isHuman 
                      ? 'rgba(255,255,255,0.3)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    marginRight: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {msg.isHuman ? '👤' : '🤖'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{msg.agent}</div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: msg.isHuman ? 'rgba(255,255,255,0.8)' : '#999' 
                    }}>
                      {msg.role}
                    </div>
                  </div>
                </div>
                {msg.isThinking ? (
                  <div style={{ fontStyle: 'italic', opacity: 0.7 }}>💭 Thinking...</div>
                ) : (
                  <div>{msg.text}</div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />

          {/* Voice & Text Input */}
          {isHumanTurn && (
            <>
              <div style={{
                position: 'fixed',
                bottom: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'white',
                padding: '20px 30px',
                borderRadius: '50px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                zIndex: 100
              }}>
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    border: 'none',
                    background: isRecording 
                      ? 'linear-gradient(135deg, #ff5f6d 0%, #ffc371 100%)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    fontSize: '36px',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s'
                  }}
                >
                  {isProcessing ? '⏳' : isRecording ? '⏹️' : '🎤'}
                </button>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    {isProcessing ? 'Processing...' : 
                     isRecording ? `🔴 ${formatDuration(recordingDuration)}` : 
                     'Your Turn'}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    {isProcessing ? 'Transcribing audio...' : 
                     isRecording ? 'Click to stop' : 
                     'Click mic to record'}
                  </div>
                </div>
              </div>

              <div style={{
                position: 'fixed',
                bottom: '20px',
                right: '20px',
                background: 'white',
                padding: '15px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                maxWidth: '350px',
                zIndex: 99
              }}>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px', fontWeight: 'bold' }}>
                  💡 Or type your response:
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    ref={textInputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && textInput.trim()) {
                        submitText();
                      }
                    }}
                    placeholder="Type and press Enter..."
                    disabled={isProcessing}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '2px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <button
                    onClick={submitText}
                    disabled={isProcessing || !textInput.trim()}
                    style={{
                      padding: '10px 20px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: (!textInput.trim() || isProcessing) ? 'not-allowed' : 'pointer',
                      opacity: (!textInput.trim() || isProcessing) ? 0.5 : 1
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div style={{
          background: 'white',
          padding: '15px 20px',
          borderTop: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '14px',
          color: '#666'
        }}>
          <span>{loading ? '🔴 Processing' : '⚪ Ready'}</span>
          <span>Round {round}</span>
          <span>{participants.length} participants</span>
        </div>
      </div>
    </div>
  );
}

export default DiscussionPage;