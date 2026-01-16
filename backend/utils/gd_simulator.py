import time
import random
import concurrent.futures
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from typing import List, Dict, Optional
import json
from gtts import gTTS
import io
import base64
import os
import tempfile
from dotenv import load_dotenv
import wave
from vosk import Model, KaldiRecognizer
import subprocess
import shutil

# -------------------------
# 🔐 Gemini Setup
# -------------------------
load_dotenv()
API_KEY = os.getenv("API_KEY")

# ✅ IMPROVED: Better FFmpeg detection
def setup_ffmpeg():
    """Detect and setup FFmpeg path"""
    # Check if ffmpeg is already in PATH
    if shutil.which("ffmpeg"):
        print("[INFO] ✅ FFmpeg found in system PATH")
        return True
    
    # Common FFmpeg installation paths
    common_paths = [
        r"C:\ffmpeg\bin",
        r"C:\Program Files\ffmpeg\bin",
        r"/usr/local/bin",
        r"/usr/bin"
    ]
    
    for path in common_paths:
        if os.path.exists(os.path.join(path, "ffmpeg.exe" if os.name == 'nt' else "ffmpeg")):
            os.environ["PATH"] += os.pathsep + path
            print(f"[INFO] ✅ FFmpeg found at: {path}")
            return True
    
    print("[ERROR] ❌ FFmpeg not found!")
    print("[INFO] 💡 Install FFmpeg:")
    print("       Windows: Download from https://ffmpeg.org/download.html")
    print("       Linux: sudo apt-get install ffmpeg")
    print("       Mac: brew install ffmpeg")
    return False

ffmpeg_available = setup_ffmpeg()

genai.configure(api_key=API_KEY)
chat_model = genai.GenerativeModel("models/gemini-2.5-flash-preview-09-2025")

# -------------------------
# 🎤 Vosk Model Setup (Offline Speech Recognition)
# -------------------------
VOSK_MODEL_PATH = "vosk-model-small-en-us-0.15"

print("[INFO] Loading Vosk speech recognition model...")
if os.path.exists(VOSK_MODEL_PATH):
    try:
        vosk_model = Model(VOSK_MODEL_PATH)
        print(f"[INFO] ✅ Vosk model loaded from: {VOSK_MODEL_PATH}")
    except Exception as e:
        vosk_model = None
        print(f"[ERROR] ❌ Failed to load Vosk model: {e}")
else:
    vosk_model = None
    print(f"[WARNING] ⚠️ Vosk model not found at: {VOSK_MODEL_PATH}")
    print("[WARNING] 💡 Download from: https://alphacephei.com/vosk/models")
    print("[WARNING] 💡 Extract to project root and rename to 'vosk-model-small-en-us-0.15'")

# -------------------------
# 🧠 Embedding Model
# -------------------------
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# -------------------------
# 🧍 Personas
# -------------------------
PERSONAS = [
    "logical and fact-driven",
    "supportive and encouraging",
    "critical but respectful",
    "creative and optimistic",
    "cautious and balanced",
    "structured and methodical"
]

# -------------------------
# 🧩 Helper Functions
# -------------------------

def safe_generate(prompt, timeout=60):
    """Call Gemini safely with timeout and debugging."""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(chat_model.generate_content, prompt)
        try:
            response = future.result(timeout=timeout)
            text = response.text.strip() if response and hasattr(response, "text") else "[No response from Gemini]"
            print(f"[DEBUG] Generated response: {text}")
            return text
        except concurrent.futures.TimeoutError:
            print("[TIMEOUT] Gemini took too long for this prompt.")
            return "[Timeout error]"
        except Exception as e:
            print(f"[ERROR] During Gemini generation: {e}")
            return f"[Error: {e}]"

def text_to_audio_base64(text, agent_name):
    """Convert text to audio with agent-specific accent."""
    try:
        accent_map = {
            "Agent 1": "co.in",
            "Agent 2": "com",
            "Agent 3": "co.uk",
            "Agent 4": "com.au"
        }

        tld = accent_map.get(agent_name, "com")
        tts = gTTS(text, lang="en", tld=tld, slow=False)

        audio_bytes = io.BytesIO()
        tts.write_to_fp(audio_bytes)
        audio_bytes.seek(0)

        return base64.b64encode(audio_bytes.read()).decode("utf-8")

    except Exception as e:
        print(f"[ERROR] TTS failed: {e}")
        return None


def transcribe_audio_vosk(audio_file):
    """
    ✅ IMPROVED: Enhanced transcription with better error handling and debugging
    """
    webm_path = None
    wav_path = None

    try:
        # Check prerequisites
        if vosk_model is None:
            print("[ERROR] ❌ Vosk model not loaded")
            return None
        
        if not ffmpeg_available:
            print("[ERROR] ❌ FFmpeg not available")
            return None

        # Read uploaded audio
        audio_data = audio_file.read()
        audio_file.seek(0)
        print(f"[DEBUG] 🎤 Received audio: {len(audio_data)} bytes")
        
        if len(audio_data) < 1000:
            print("[ERROR] ❌ Audio file too small (likely empty recording)")
            return None

        # Create temp directory if it doesn't exist
        temp_dir = tempfile.gettempdir()
        print(f"[DEBUG] 📁 Using temp directory: {temp_dir}")

        # Save WebM temporarily with unique filename
        timestamp = int(time.time() * 1000)
        webm_path = os.path.join(temp_dir, f"recording_{timestamp}.webm")
        wav_path = os.path.join(temp_dir, f"recording_{timestamp}.wav")
        
        with open(webm_path, 'wb') as f:
            f.write(audio_data)
        print(f"[DEBUG] 💾 Saved WebM to: {webm_path}")

        # 🔄 Convert WebM → WAV using FFmpeg with verbose output
        print("[DEBUG] 🔄 Converting WebM → WAV using FFmpeg...")
        
        ffmpeg_cmd = [
            "ffmpeg",
            "-y",  # Overwrite output file
            "-i", webm_path,  # Input file
            "-ac", "1",  # Mono audio
            "-ar", "16000",  # 16kHz sample rate
            "-sample_fmt", "s16",  # 16-bit PCM
            "-f", "wav",  # Force WAV format
            wav_path
        ]
        
        print(f"[DEBUG] Running: {' '.join(ffmpeg_cmd)}")
        
        result = subprocess.run(
            ffmpeg_cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"[ERROR] ❌ FFmpeg failed with code {result.returncode}")
            print(f"[ERROR] FFmpeg stderr: {result.stderr}")
            return None
        
        print(f"[DEBUG] ✅ FFmpeg conversion successful")

        # Verify WAV file exists and has content
        if not os.path.exists(wav_path):
            print("[ERROR] ❌ WAV file was not created")
            return None
        
        wav_size = os.path.getsize(wav_path)
        print(f"[DEBUG] 📊 WAV file size: {wav_size} bytes")
        
        if wav_size < 1000:
            print("[ERROR] ❌ WAV file too small (conversion likely failed)")
            return None

        # Open WAV file
        wf = wave.open(wav_path, "rb")
        
        print(f"[DEBUG] 📊 WAV properties:")
        print(f"  - Channels: {wf.getnchannels()}")
        print(f"  - Sample width: {wf.getsampwidth()}")
        print(f"  - Frame rate: {wf.getframerate()}")
        print(f"  - Frames: {wf.getnframes()}")
        print(f"  - Duration: {wf.getnframes() / wf.getframerate():.2f}s")

        # Validate WAV format
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
            print("[ERROR] ❌ Invalid WAV format for Vosk")
            print(f"  Expected: 1 channel, 2 bytes sample width")
            print(f"  Got: {wf.getnchannels()} channels, {wf.getsampwidth()} bytes")
            wf.close()
            return None

        # Create recognizer
        print("[DEBUG] 🎯 Creating Vosk recognizer...")
        rec = KaldiRecognizer(vosk_model, wf.getframerate())
        rec.SetWords(True)

        result_text = ""
        frames_processed = 0

        print("[DEBUG] 🔍 Starting transcription...")
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            
            frames_processed += 1
            if rec.AcceptWaveform(data):
                part_result = json.loads(rec.Result())
                part_text = part_result.get("text", "")
                if part_text:
                    print(f"[DEBUG] 📝 Partial result: '{part_text}'")
                    result_text += part_text + " "

        # Get final result
        final_result = json.loads(rec.FinalResult())
        final_text = final_result.get("text", "")
        if final_text:
            print(f"[DEBUG] 📝 Final result: '{final_text}'")
            result_text += final_text
        
        wf.close()
        
        result_text = result_text.strip()
        print(f"[DEBUG] 📊 Processed {frames_processed} frame chunks")

        if result_text:
            print(f"[SUCCESS] ✅ Transcribed: '{result_text}'")
            return result_text
        else:
            print("[ERROR] ❌ No speech detected in audio")
            print("[INFO] 💡 Possible causes:")
            print("  - Audio too quiet")
            print("  - Background noise too loud")
            print("  - Recording too short")
            print("  - Microphone not working properly")
            return None

    except subprocess.TimeoutExpired:
        print("[ERROR] ❌ FFmpeg conversion timeout (>30s)")
        return None
    
    except subprocess.CalledProcessError as e:
        print(f"[ERROR] ❌ FFmpeg failed: {e}")
        return None

    except Exception as e:
        print(f"[ERROR] ❌ Vosk transcription failed: {e}")
        import traceback
        print(f"[ERROR] Full traceback:\n{traceback.format_exc()}")
        return None

    finally:
        # Cleanup temp files
        for path in [webm_path, wav_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                    print(f"[DEBUG] 🗑️ Cleaned up: {path}")
                except Exception as e:
                    print(f"[WARNING] ⚠️ Could not delete {path}: {e}")


# Alias for compatibility
transcribe_audio = transcribe_audio_vosk

# -------------------------
# 🗣️ Agent Class
# -------------------------
class Agent:
    def __init__(self, name, persona):
        self.name = name
        self.persona = persona

    def prepare_prompt(self, topic, utterances, is_first=False, human_just_spoke=False):
        full_discussion = "\n".join(
            f"- {u['agent']}: {u['text']}" for u in utterances
        )

        last_remark = utterances[-1]["text"] if utterances else ""
        last_speaker = utterances[-1]["agent"] if utterances else ""
        
        if is_first and not utterances:
            return f"""
You are {self.name}, a participant in a group discussion.
Your style: {self.persona}.
Topic: {topic}

You are the first to speak. Start naturally with your viewpoint (under 80 words).

Speak like a normal college student in a group discussion.

Rules:
- Keep it simple and conversational
- Use short sentences
- Avoid formal or academic language
- It's okay to sound slightly casual
- Say just one clear point
- Do NOT explain too much
- 25–50 words only

You may naturally use phrases like:
"I think", "Honestly", "I feel", "To be fair", "I agree, but"
"""
        
        human_context = ""
        if human_just_spoke and last_speaker == "You":
            human_context = f"\n\nIMPORTANT: A human participant (labeled 'You') just shared their view: \"{last_remark}\"\nRespond directly to their point, acknowledging what they said."
        
        return f"""
You are {self.name}, a participant in a group discussion.
Your style: {self.persona}.
Topic: {topic}

Discussion so far (for your awareness only, do NOT summarize or repeat it):
{full_discussion or "No prior remarks."}

Most recent comment from {last_speaker}:
"{last_remark}"{human_context}

Respond naturally in under 80 words, staying consistent with your persona.
Speak like a normal college student in a group discussion.

Rules:
- Keep it simple and conversational
- Use short sentences
- Avoid formal or academic language
- It's okay to sound slightly casual
- Say just one clear point
- Do NOT explain too much
- 25–50 words only
{"- Acknowledge the human's point naturally if they just spoke" if human_just_spoke else ""}

You may naturally use phrases like:
"I think", "Honestly", "I feel", "To be fair", "I agree, but"
"""

    def generate_response(self, prompt):
        print(f"[DEBUG] {self.name} is generating response...")
        text = safe_generate(prompt)
        print(f"[DEBUG] {self.name} finished response.")
        return text

# -------------------------
# ⚙️ FastAPI setup
# -------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# 🗂️ In-memory simulations
# -------------------------
SIMULATIONS = {}

class SimulationRequest(BaseModel):
    topic: str
    num_agents: int = 4
    rounds: int = 2
    human_participant: bool = True

class HumanInputRequest(BaseModel):
    text: Optional[str] = None

# -------------------------
# 🚀 API Endpoints
# -------------------------
@app.post("/start_simulation")
def start_simulation(req: SimulationRequest):
    print(f"\n{'='*60}")
    print(f"🎬 STARTING NEW SIMULATION")
    print(f"{'='*60}")
    print(f"📋 Topic: {req.topic}")
    print(f"👥 Agents: {req.num_agents}")
    print(f"🔄 Rounds: {req.rounds}")
    print(f"🎤 Human Participant: {req.human_participant}")

    selected_personas = random.sample(PERSONAS, req.num_agents)
    agents = [Agent(f"Agent {i+1}", persona) for i, persona in enumerate(selected_personas)]
    sim_id = str(len(SIMULATIONS) + 1)
    SIMULATIONS[sim_id] = {
        "topic": req.topic,
        "agents": agents,
        "utterances": [],
        "current_round": 0,
        "total_rounds": req.rounds,
        "human_participant": req.human_participant,
        "awaiting_human": False
    }

    print(f"\n✅ Simulation ID: {sim_id}")
    print("👥 Agent Lineup:")
    for a in agents:
        print(f"   • {a.name}: {a.persona}")
    print(f"{'='*60}\n")

    agent_list = [{"name": agent.name, "persona": agent.persona} for agent in agents]
    return {"simulation_id": sim_id, "agents": agent_list}

@app.post("/submit_human_input/{sim_id}")
async def submit_human_input(sim_id: str, audio: Optional[UploadFile] = File(None), text: Optional[str] = None):
    """Accept human input via voice or text."""
    print(f"\n{'='*60}")
    print(f"👤 HUMAN INPUT RECEIVED")
    print(f"{'='*60}")
    
    if sim_id not in SIMULATIONS:
        print("❌ ERROR: Simulation ID not found")
        return {"error": "Simulation ID not found."}
    
    sim = SIMULATIONS[sim_id]
    
    # Get human input
    human_text = None
    if audio:
        print("🎤 Processing voice input with Vosk...")
        human_text = transcribe_audio(audio.file)
    elif text:
        print(f"⌨️  Processing text input: '{text}'")
        human_text = text
    
    if not human_text:
        error_msg = "Could not transcribe audio. "
        if not vosk_model:
            error_msg += "Vosk model not loaded. "
        if not ffmpeg_available:
            error_msg += "FFmpeg not available. "
        error_msg += "Please use text input instead."
        
        print(f"❌ ERROR: {error_msg}")
        return {"error": error_msg}
    
    print(f"\n💬 HUMAN SAID: \"{human_text}\"")
    print(f"{'='*60}\n")
    
    # Add human utterance to discussion
    sim["utterances"].append({
        "agent": "You",
        "text": human_text,
        "audio": None
    })
    
    sim["awaiting_human"] = False
    
    return {"success": True, "transcribed_text": human_text}

@app.post("/next_round/{sim_id}")
def next_round(sim_id: str):
    if sim_id not in SIMULATIONS:
        return {"error": "Simulation ID not found."}

    sim = SIMULATIONS[sim_id]
    if sim["current_round"] >= sim["total_rounds"]:
        return {"message": "Simulation completed.", "utterances": sim["utterances"]}

    utterances = sim["utterances"]
    agents = sim["agents"]
    topic = sim["topic"]
    human_participant = sim["human_participant"]

    speaking_order = []
    if human_participant:
        all_speakers = agents.copy()
        human_position = random.randint(0, len(all_speakers))
        speaking_order = all_speakers[:human_position] + ["HUMAN_TURN"] + all_speakers[human_position:]
    else:
        speaking_order = random.sample(agents, len(agents))
    
    print(f"\n{'='*60}")
    print(f"🔄 ROUND {sim['current_round'] + 1} STARTING")
    print(f"{'='*60}")
    print(f"📢 Speaking order: {[a.name if isinstance(a, Agent) else '👤 You (Human)' for a in speaking_order]}")
    print(f"{'='*60}\n")
    
    def generate():
        human_just_spoke = False
        
        for i, speaker in enumerate(speaking_order):
            if speaker == "HUMAN_TURN":
                print(f"\n🎤 {'='*50}")
                print(f"   YOUR TURN TO SPEAK!")
                print(f"   {'='*50}\n")
                
                yield f"data: {json.dumps({'type': 'human_turn'})}\n\n"
                sim["awaiting_human"] = True
                
                max_wait = 120
                waited = 0
                while sim["awaiting_human"] and waited < max_wait:
                    time.sleep(1)
                    waited += 1
                
                if waited >= max_wait:
                    print("⏰ TIMEOUT: Human took too long to respond")
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Timeout waiting for human input'})}\n\n"
                    continue
                
                human_utterance = sim["utterances"][-1]
                print(f"✅ Human response submitted: \"{human_utterance['text']}\"")
                yield f"data: {json.dumps({'type': 'human_response', 'text': human_utterance['text']})}\n\n"
                human_just_spoke = True
                
            else:
                agent = speaker
                print(f"\n💭 {agent.name} is thinking...")
                yield f"data: {json.dumps({'type': 'thinking', 'agent': agent.name})}\n\n"
                
                prompt = agent.prepare_prompt(
                    topic, 
                    utterances, 
                    is_first=(sim["current_round"] == 0 and i == 0),
                    human_just_spoke=human_just_spoke
                )
                text = agent.generate_response(prompt)
                audio_base64 = text_to_audio_base64(text, agent.name)

                data = {"agent": agent.name, "text": text, "audio": audio_base64}
                utterances.append(data)

                print(f"🗣️  {agent.name}: \"{text}\"")
                yield f"data: {json.dumps({'type': 'response', 'agent': agent.name, 'text': text, 'audio': audio_base64})}\n\n"
                
                human_just_spoke = False
        
        sim["current_round"] += 1
        print(f"\n🎉 Round {sim['current_round']} completed!\n")
        yield f"data: {json.dumps({'type': 'complete', 'round': sim['current_round']})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.get("/simulation_status/{sim_id}")
def get_status(sim_id: str):
    """Get current simulation status."""
    if sim_id not in SIMULATIONS:
        return {"error": "Simulation ID not found."}
    
    sim = SIMULATIONS[sim_id]
    return {
        "current_round": sim["current_round"],
        "total_rounds": sim["total_rounds"],
        "awaiting_human": sim["awaiting_human"],
        "utterances_count": len(sim["utterances"]),
        "vosk_loaded": vosk_model is not None,
        "ffmpeg_available": ffmpeg_available
    }

@app.get("/health")
def health_check():
    """Check if all required components are available."""
    return {
        "status": "ok",
        "vosk_model_loaded": vosk_model is not None,
        "ffmpeg_available": ffmpeg_available,
        "vosk_model_path": VOSK_MODEL_PATH if os.path.exists(VOSK_MODEL_PATH) else "Not found"
    }