import time
import random
import concurrent.futures
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google import genai
# import google.generativeai as genai
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
import whisper
from database import SessionLocal
from models import Discussion, HumanResponse

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
    print("  Windows: Download from https://ffmpeg.org/download.html")
    print("  Linux: sudo apt-get install ffmpeg")
    print("  Mac: brew install ffmpeg")
    return False

ffmpeg_available = setup_ffmpeg()
client = genai.Client(api_key=API_KEY)


# -------------------------
# 🎤 Whisper Model Setup
# -------------------------
print("[INFO] 🧠 Loading Whisper model...")
try:
    whisper_model = whisper.load_model("small")
    print("[INFO] ✅ Whisper model loaded successfully")
except Exception as e:
    whisper_model = None
    print(f"[ERROR] ❌ Failed to load Whisper model: {e}")

# -------------------------
# 🎤 Vosk Model Setup (Offline Speech Recognition - Fallback)
# -------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VOSK_MODEL_PATH = os.path.join(BASE_DIR, "vosk-model-small-en-us-0.15")

print("[INFO] Loading Vosk speech recognition model...")
print("[DEBUG] Looking for model at:", VOSK_MODEL_PATH)
print("[DEBUG] Exists:", os.path.exists(VOSK_MODEL_PATH))

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

# -------------------------
#  Personas
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
def safe_generate(prompt, timeout=60, is_json=False):
    """Call Gemini safely with timeout and debugging."""

    def call_gemini():
        kwargs = {}
        if is_json:
            kwargs["config"] = genai.types.GenerateContentConfig(response_mime_type="application/json")
            
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            **kwargs
        )
        return response.text if response and hasattr(response, "text") else None

    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(call_gemini)

        try:
            text = future.result(timeout=timeout)
            if text:
                text = text.strip()
                print(f"[DEBUG] Generated response: {text}")
                return text
            return "[No response from Gemini]"

        except concurrent.futures.TimeoutError:
            print("[TIMEOUT] Gemini took too long for this prompt.")
            return "[Timeout error]"

        except Exception as e:
            print(f"[ERROR] During Gemini generation: {e}")
            return f"[Error: {e}]" 


def generate_human_feedback(text: str, topic: str):
    """
    Generate evaluation scores + feedback using Gemini.
    """

    prompt = f"""
You are an English communication evaluator.

Topic: {topic}

Student Response:
"{text}"

Evaluate from 1-10:
- Grammar
- Clarity
- Relevance to topic
- Politeness / tone

Return strictly in JSON:

{{
  "grammar_score": int,
  "clarity_score": int,
  "relevance_score": int,
  "politeness_score": int,
  "feedback": "Constructive feedback (80-120 words)"
}}

No extra text.
"""

    response_text = safe_generate(prompt)

    try:
        cleaned = response_text.strip().replace("```json", "").replace("```", "")
        return json.loads(cleaned)
    except:
        return None

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

def transcribe_audio_whisper(audio_file):
    """
    ✅ PRIMARY: Transcribe audio using Whisper (more accurate)
    """
    temp_path = None
    try:
        # Check prerequisites
        if whisper_model is None:
            print("[ERROR] ❌ Whisper model not loaded")
            return None
        
        if not ffmpeg_available:
            print("[ERROR] ❌ FFmpeg not available (required for Whisper)")
            return None
        
        # Read uploaded audio
        audio_data = audio_file.read()
        audio_file.seek(0)
        print(f"[DEBUG] 🎤 Received audio: {len(audio_data)} bytes")
        
        if len(audio_data) < 1000:
            print("[ERROR] ❌ Audio file too small (likely empty recording)")
            return None
        
        # Create temp file
        temp_dir = tempfile.gettempdir()
        timestamp = int(time.time() * 1000)
        temp_path = os.path.join(temp_dir, f"whisper_audio_{timestamp}.webm")
        
        with open(temp_path, 'wb') as f:
            f.write(audio_data)
        
        print(f"[DEBUG] 💾 Saved audio to: {temp_path}")
        print("[DEBUG] 🧠 Transcribing with Whisper...")
        
        # Transcribe with Whisper
        result = whisper_model.transcribe(temp_path)
        transcribed_text = result["text"].strip()
        
        if transcribed_text:
            print(f"[SUCCESS] ✅ Whisper transcribed: '{transcribed_text}'")
            return transcribed_text
        else:
            print("[ERROR] ❌ Whisper returned empty transcription")
            return None
            
    except Exception as e:
        print(f"[ERROR] ❌ Whisper transcription failed: {e}")
        import traceback
        print(f"[ERROR] Full traceback:\n{traceback.format_exc()}")
        return None
    finally:
        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
                print(f"[DEBUG] 🗑️ Cleaned up: {temp_path}")
            except Exception as e:
                print(f"[WARNING] ⚠️ Could not delete {temp_path}: {e}")

def transcribe_audio_vosk(audio_file):
    """
    ✅ FALLBACK: Enhanced transcription with Vosk (used if Whisper fails)
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
        
        # 🔄 Convert WebM → WAV using FFmpeg
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
            print(f"[SUCCESS] ✅ Vosk transcribed: '{result_text}'")
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

def transcribe_audio(audio_file):
    """
    ✅ HYBRID: Try Whisper first (more accurate), fallback to Vosk
    """
    print("[INFO] 🎯 Attempting transcription with Whisper (primary)...")
    
    # Try Whisper first
    if whisper_model is not None:
        result = transcribe_audio_whisper(audio_file)
        if result:
            return result
        print("[WARNING] ⚠️ Whisper failed, trying Vosk fallback...")
    else:
        print("[WARNING] ⚠️ Whisper not available, using Vosk...")
    
    # Fallback to Vosk
    if vosk_model is not None:
        return transcribe_audio_vosk(audio_file)
    
    print("[ERROR] ❌ Both Whisper and Vosk unavailable")
    return None

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

You may naturally use phrases like: "I think", "Honestly", "I feel", "To be fair", "I agree, but"
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

Most recent comment from {last_speaker}: "{last_remark}"{human_context}

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

You may naturally use phrases like: "I think", "Honestly", "I feel", "To be fair", "I agree, but"
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
    rounds: int = 3
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
    
    # -------------------------
    # 💾 CREATE DISCUSSION IN DB
    # -------------------------
    db = SessionLocal()
    try:
        discussion = Discussion(
            user_id=1,  # 🔥 Replace with actual logged-in user ID
            topic=req.topic,
            total_rounds=req.rounds,
            human_participant=req.human_participant
        )
        db.add(discussion)
        db.commit()
        db.refresh(discussion)

        sim_id = str(discussion.id)

    except Exception as e:
        print("❌ DB ERROR:", e)
        db.rollback()
        return {"error": "Database error while creating discussion"}
    finally:
        db.close()

    # -------------------------
    # SIMULATION STRUCTURE WITH INTERRUPT SUPPORT
    # -------------------------
    SIMULATIONS[sim_id] = {
        "topic": req.topic,
        "agents": agents,
        "utterances": [],
        "current_round": 0,
        "total_rounds": req.rounds,
        "human_participant": req.human_participant,
        "awaiting_human": False,
        # Interrupt system fields
        "interrupt_reserved": False,
        "human_interrupt_count": 0,
        "current_speaker": None
    }
    
    print(f"\n✅ Simulation ID: {sim_id}")
    print("👥 Agent Lineup:")
    for a in agents:
        print(f"  • {a.name}: {a.persona}")
    print(f"{'='*60}\n")
    
    agent_list = [{"name": agent.name, "persona": agent.persona} for agent in agents]
    return {"simulation_id": sim_id, "agents": agent_list}


@app.post("/reserve_interrupt/{sim_id}")
def reserve_interrupt(sim_id: str):
    """Allow human to interrupt and reserve the next speaking turn."""
    print(f"\n{'='*60}")
    print(f"🔔 INTERRUPT RESERVED")
    print(f"{'='*60}")
    
    if sim_id not in SIMULATIONS:
        print("❌ ERROR: Simulation ID not found")
        return {"error": "Simulation ID not found."}
    
    sim = SIMULATIONS[sim_id]
    
    if sim["interrupt_reserved"]:
        print("⚠️ Interrupt already reserved")
        return {"message": "Interrupt already reserved", "success": False}
    
    sim["interrupt_reserved"] = True
    sim["human_interrupt_count"] += 1
    
    print(f"✅ Interrupt #{sim['human_interrupt_count']} reserved by human")
    print(f"Current speaker will finish, then human gets next turn")
    print(f"{'='*60}\n")
    
    return {
        "success": True,
        "interrupt_reserved": True,
        "interrupt_count": sim["human_interrupt_count"],
        "message": "Next chance reserved"
    }


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
        print("🎤 Processing voice input (Whisper primary, Vosk fallback)...")
        human_text = transcribe_audio(audio.file)
    elif text:
        print(f"⌨️ Processing text input: '{text}'")
        human_text = text
    
    if not human_text:
        error_msg = "Could not transcribe audio. "
        if not whisper_model and not vosk_model:
            error_msg += "No speech recognition models loaded. "
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
        "audio": None,
        "timestamp": time.time()
    })
    sim["awaiting_human"] = False

    # --------------------------------------------------
    # 🧠 GENERATE FEEDBACK USING GEMINI
    # --------------------------------------------------
    feedback_prompt = f"""
You are an English communication evaluator.

Topic: {sim['topic']}

Student Response:
"{human_text}"

Evaluate from 1-10:
- Grammar
- Clarity
- Relevance
- Politeness

Return strictly in JSON:

{{
  "grammar_score": int,
  "clarity_score": int,
  "relevance_score": int,
  "politeness_score": int,
  "feedback": "Constructive feedback (80-120 words)"
}}

Do NOT add extra text.
"""

    feedback_data = None
    response_text = safe_generate(feedback_prompt)

    if response_text:
        try:
            cleaned = response_text.replace("```json", "").replace("```", "").strip()
            feedback_data = json.loads(cleaned)
        except Exception as e:
            print("⚠️ Failed to parse Gemini JSON:", e)

    # --------------------------------------------------
    # 💾 SAVE RESPONSE + SCORES IN DATABASE
    # --------------------------------------------------
    db = SessionLocal()
    try:
        discussion = db.query(Discussion).filter(
            Discussion.id == int(sim_id)
        ).first()

        if discussion and feedback_data:
            human_response = HumanResponse(
                discussion_id=discussion.id,
                round_number=sim["current_round"] + 1,
                text=human_text,
                grammar_score=feedback_data.get("grammar_score"),
                clarity_score=feedback_data.get("clarity_score"),
                relevance_score=feedback_data.get("relevance_score"),
                politeness_score=feedback_data.get("politeness_score"),
                feedback=feedback_data.get("feedback")
            )

            db.add(human_response)
            db.commit()

            print("\n📊 HUMAN FEEDBACK GENERATED:")
            print(feedback_data)

    except Exception as e:
        print("❌ DB ERROR:", e)
        db.rollback()
    finally:
        db.close()
    
    return {"success": True, "transcribed_text": human_text}


# -------------------------
# 🧩 Helper: Pre-generate agent response
# -------------------------
def generate_agent_response(agent, topic, utterances_snapshot, human_just_spoke):
    """Pre-generate an agent's response text and audio."""
    prompt = agent.prepare_prompt(
        topic,
        utterances_snapshot,
        human_just_spoke=human_just_spoke
    )
    text = agent.generate_response(prompt)
    audio = text_to_audio_base64(text, agent.name)
    return text, audio


@app.post("/next_round/{sim_id}")
def next_round(sim_id: str):
    if sim_id not in SIMULATIONS:
        return {"error": "Simulation ID not found."}
    
    sim = SIMULATIONS[sim_id]
    
    if sim["current_round"] >= sim["total_rounds"]:

        db = SessionLocal()

        try:
            responses = db.query(HumanResponse).filter(
                HumanResponse.discussion_id == int(sim_id)
            ).all()

            if responses:
                combined_text = "\n".join([r.text for r in responses])

                final_prompt = f"""
    You are a communication coach.

    Here are all responses from a student in a group discussion:

    {combined_text}

    Provide:
    1. Overall performance summary
    2. Strengths
    3. Areas for improvement
    4. Final rating out of 10

    Keep it constructive.
    """

                final_feedback = safe_generate(final_prompt)

                print("\n🎓 FINAL DISCUSSION FEEDBACK:")
                print(final_feedback)

        finally:
            db.close()

        return {"message": "Simulation completed.", "utterances": sim["utterances"]}
        
    utterances = sim["utterances"]
    agents = sim["agents"]
    topic = sim["topic"]
    
    # ✅ SPEAKING ORDER: FIXED SEQUENTIAL AGENTS ONLY (NO RANDOM, NO HUMAN)
    speaking_order = agents  # Agents always speak in the same order each round
    
    print(f"\n{'='*60}")
    print(f"🔄 ROUND {sim['current_round'] + 1} STARTING")
    print(f"{'='*60}")
    print(f"📢 Speaking order: {[a.name for a in speaking_order]}")
    print(f"ℹ️ Human can interrupt anytime via button")
    print(f"{'='*60}\n")
    
    def generate():
        nonlocal utterances
        human_just_spoke = False
        next_agent_future = None
        next_agent_index = 0  # ✅ Track which agent to prepare

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            for i, agent in enumerate(speaking_order):
                sim["current_speaker"] = agent.name
                text, audio_base64 = None, None

                # ── WAIT FOR PRE-GENERATED TEXT (if any) AND CHECK FOR INTERRUPTS ──
                if next_agent_future is not None:
                    wait_time = 0
                    while wait_time < 90:
                        if sim["interrupt_reserved"]:
                            print(f"\n🔔 INTERRUPT DETECTED! Discarding pre-generated text for {agent.name}")
                            next_agent_future = None
                            # We break immediately here because the agent hasn't started speaking yet,
                            # so we can switch to the human right away.
                            break
                        try:
                            text, audio_base64 = next_agent_future.result(timeout=0.5)
                            print(f"✅ Using pre-generated text for {agent.name}")
                            break
                        except concurrent.futures.TimeoutError:
                            wait_time += 0.5
                            continue

                # ── HANDLE INTERRUPT: HUMAN TURN BEFORE THIS AGENT SPEAKS ──
                if sim["interrupt_reserved"]:
                    sim["interrupt_reserved"] = False
                    
                    # Signal human turn immediately
                    yield f"data: {json.dumps({'type': 'human_start'})}\n\n"
                    sim["awaiting_human"] = True

                    # Wait for human input (max 120 seconds)
                    max_wait = 120
                    waited = 0
                    while sim["awaiting_human"] and waited < max_wait:
                        time.sleep(1)
                        waited += 1

                    if waited >= max_wait:
                        print("⏰ TIMEOUT: Human took too long to respond")
                        yield f"data: {json.dumps({'type': 'error', 'message': 'Timeout waiting for human input'})}\n\n"
                    else:
                        human_utterance = sim["utterances"][-1]
                        print(f"✅ Human submitted: \"{human_utterance['text']}\"")
                        yield f"data: {json.dumps({'type': 'human_response', 'text': human_utterance['text']})}\n\n"
                        human_just_spoke = True

                    # RE-GENERATE THIS AGENT'S TEXT NOW (incorporating human input)
                    print(f"🔄 Re-generating {agent.name}'s text (incorporating human input)...")
                    prompt = agent.prepare_prompt(
                        topic, list(utterances),
                        is_first=(i == 0 and sim["current_round"] == 0),
                        human_just_spoke=human_just_spoke
                    )
                    text = agent.generate_response(prompt)
                    audio_base64 = text_to_audio_base64(text, agent.name)
                    human_just_spoke = False
                    
                    # ✅ Clear next_agent_future when human interrupts
                    next_agent_future = None

                # ── IF NOT INTERRUPTED AND NO PRE-GENERATED TEXT ──
                elif text is None:
                    print(f"\n💭 {agent.name} is thinking...")
                    prompt = agent.prepare_prompt(
                        topic, list(utterances),
                        is_first=(i == 0 and sim["current_round"] == 0),
                        human_just_spoke=human_just_spoke
                    )
                    text = agent.generate_response(prompt)
                    audio_base64 = text_to_audio_base64(text, agent.name)

                # ── ADD TO UTTERANCES AND SEND TO FRONTEND ──
                utterance_data = {
                    "agent": agent.name,
                    "text": text,
                    "audio": audio_base64,
                    "timestamp": time.time()
                }
                utterances.append(utterance_data)

                print(f"🗣️ {agent.name}: \"{text}\"")
                yield f"data: {json.dumps({'type': 'agent_speaking', 'agent': agent.name})}\n\n"
                yield f"data: {json.dumps({'type': 'response', 'agent': agent.name, 'text': text, 'audio': audio_base64})}\n\n"

                # ── START PRE-GENERATING ONLY THE NEXT AGENT IN SEQUENCE ──
                next_i = i + 1
                if next_i < len(speaking_order):
                    next_agent = speaking_order[next_i]
                    print(f"⏳ Pre-generating text for {next_agent.name} (next in sequence)...")
                    next_agent_future = executor.submit(
                        generate_agent_response,
                        next_agent, topic, list(utterances), False
                    )

                # ── SYNC BACKEND LOOP WITH FRONTEND AUDIO PLAYBACK ──
                if text:
                    word_count = len(text.split())
                    estimated_audio_duration = word_count / 1.8 
                    sleep_time = estimated_audio_duration + 1.5
                    
                    print(f"⏳ Backend syncing with frontend audio playback ({sleep_time:.1f}s)...")
                    slept = 0
                    interrupt_notified = False
                    while slept < sleep_time:
                        if sim["interrupt_reserved"] and not interrupt_notified:
                            print(f"\n🔔 INTERRUPT DETECTED during {agent.name}'s audio playback sync! Will switch to human after audio finishes.")
                            interrupt_notified = True
                            # ✅ FIX: Do NOT break here, let the audio finish playing!
                            
                        # If a new client connects or something, we still sleep the exact amount.
                        time.sleep(0.5)
                        slept += 0.5

            # ✅ ROUND COMPLETE
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
        "whisper_loaded": whisper_model is not None,
        "ffmpeg_available": ffmpeg_available,

        # Optional: derived flag (recommended)
        "voice_available": whisper_model is not None and ffmpeg_available
    }

@app.get("/health")
def health_check():
    """Check if all required components are available."""
    status_msg = []
    
    if whisper_model is not None:
        status_msg.append("Whisper (primary)")
    if vosk_model is not None:
        status_msg.append("Vosk (fallback)")
    if not whisper_model and not vosk_model:
        status_msg.append("No STT available")
    
    return {
        "status": "ok",
        "speech_recognition": " + ".join(status_msg) if status_msg else "unavailable",
        "whisper_loaded": whisper_model is not None,
        "vosk_model_loaded": vosk_model is not None,
        "ffmpeg_available": ffmpeg_available,
        "vosk_model_path": VOSK_MODEL_PATH if os.path.exists(VOSK_MODEL_PATH) else "Not found"
    }


@app.get("/discussion/{sim_id}/feedback")
def get_discussion_feedback(sim_id: str):
    db = SessionLocal()
    try:
        discussion = db.query(Discussion).filter(
            Discussion.id == int(sim_id)
        ).first()

        if not discussion:
            return {"detail": "Not found"}

        rounds = db.query(HumanResponse).filter(
            HumanResponse.discussion_id == int(sim_id)
        ).order_by(HumanResponse.round_number).all()

        def safe_parse_json_list(val):
            if not val:
                return []
            try:
                return json.loads(val)
            except Exception:
                # If the LLM returned garbage at the end (e.g. `]学]`), it throws JSONDecodeError
                # We can strip the garbage or return it as a single raw string to avoid 500 Error
                cleaned = str(val).strip()
                # Find the last closing bracket to attempt rescuing the list
                last_bracket = cleaned.rfind(']')
                if last_bracket != -1:
                    try:
                        return json.loads(cleaned[:last_bracket+1])
                    except:
                        pass
                return [cleaned]

        return {
            "discussion": {
                "topic": discussion.topic,
                "total_rounds": discussion.total_rounds,
                "human_interrupt_count": discussion.human_interrupt_count if hasattr(discussion, 'human_interrupt_count') else 0,
            },
            "evaluation": {
                "grammar": discussion.grammar_score if hasattr(discussion, 'grammar_score') else 0,
                "clarity": discussion.clarity_score if hasattr(discussion, 'clarity_score') else 0,
                "relevance": discussion.relevance_score if hasattr(discussion, 'relevance_score') else 0,
                "politeness": discussion.politeness_score if hasattr(discussion, 'politeness_score') else 0,
                "team_collaboration": discussion.team_collaboration_score if hasattr(discussion, 'team_collaboration_score') else 0,
                "overall": discussion.overall_score if hasattr(discussion, 'overall_score') else 0,
                "human_percentage": discussion.human_percentage if hasattr(discussion, 'human_percentage') else 0,
                "human_interrupt_count": discussion.human_interrupt_count if hasattr(discussion, 'human_interrupt_count') else 0,
                "strengths": safe_parse_json_list(discussion.strengths if hasattr(discussion, 'strengths') else None),
                "improvements": safe_parse_json_list(discussion.improvements if hasattr(discussion, 'improvements') else None),
                "final_feedback": discussion.final_feedback if hasattr(discussion, 'final_feedback') else "",
                "topic": discussion.topic,
            },
            "rounds": [
                {
                    "round_number": r.round_number,
                    "text": r.text,
                    "grammar_score": r.grammar_score,
                    "clarity_score": r.clarity_score,
                    "relevance_score": r.relevance_score,
                    "politeness_score": r.politeness_score,
                    "feedback": r.feedback,
                }
                for r in rounds
            ]
        }
    finally:
        db.close()


@app.post("/end_discussion/{sim_id}")
def end_discussion(sim_id: str):
    if sim_id not in SIMULATIONS:
        return {"error": "Simulation ID not found."}

    sim = SIMULATIONS[sim_id]
    utterances = sim["utterances"]
    # -------------------------
    # 📊 Participation Analysis
    # -------------------------

    total_time = 0
    human_time = 0

    # Sort by timestamp (safe guard)
    utterances = sorted(
        [u for u in utterances if "timestamp" in u],
        key=lambda x: x["timestamp"]
    )
    discussion_end_time = time.time()
    for i in range(len(utterances) - 1):
        current = utterances[i]
        next_utt = utterances[i + 1]

        duration = next_utt["timestamp"] - current["timestamp"]

        total_time += duration

        if current["agent"] == "You":
            human_time += duration
    # 🟢 Handle last speaker duration
    if utterances:
        last_utt = utterances[-1]
        last_duration = discussion_end_time - last_utt["timestamp"]

        total_time += last_duration

        if last_utt["agent"] == "You":
            human_time += last_duration

    if total_time > 0:
        human_percentage = round((human_time / total_time) * 100, 2)
    else:
        human_percentage = 0

    print(f"\n🗣️ HUMAN SPEAKING SHARE: {human_percentage}%")
    topic = sim["topic"]

    # 🔥 Build full discussion transcript
    transcript = ""
    for u in utterances:
        transcript += f"{u['agent']}: {u['text']}\n"

    # Extract only human responses
    human_texts = [
        u["text"] for u in utterances if u["agent"] == "You"
    ]

    if not human_texts:
        return {"error": "No human participation found."}

    full_human_text = "\n".join(human_texts)

    # 🔥 Enhanced Evaluation Prompt WITH INTERRUPT ANALYSIS
    human_interrupt_count = sim.get("human_interrupt_count", 0)
    interrupt_context = ""
    if human_interrupt_count > 0:
        interrupt_context = f"\n\nINTERRUPT ANALYSIS:\nThe human participant triggered {human_interrupt_count} interrupts during the discussion.\nPlease evaluate:\n- Were interrupts timely and appropriate?\n- Did interrupts add value to the discussion?\n- Did interrupts disrupt the flow or enhance engagement?\n- Overall quality of interrupt usage"
    
    evaluation_prompt = f"""
You are an expert Group Discussion evaluator.

Topic: {topic}
Human speaking share: {human_percentage}% of total discussion.
Human interrupts: {human_interrupt_count}
Full Discussion Transcript:
{transcript}

Human participant name: You

Evaluate the human participant on:

1. Grammar (0-10)
2. Clarity (0-10)
3. Relevance to topic (0-10)
4. Politeness (0-10)
5. Team Collaboration (0-10)

For Team Collaboration consider:
- Did the user acknowledge others?
- Did the user build on AI agents' ideas?
- Did the user respectfully agree/disagree?
- Did the user help move discussion forward?{interrupt_context}

Also provide:
- Overall score (0-10)
- 3 strengths
- 3 areas of improvement
- Final detailed feedback paragraph (must include collaboration comments and interrupt analysis if applicable)

Also comment whether participation level was:
- Too low (<20%)
- Balanced (20-40%)
- Dominating (>40%)

Return strictly in JSON format. For the score values, YOU MUST ONLY RETURN PURE INTEGERS (e.g. 8). DO NOT RETURN FRACTIONS OR TEXT (e.g. "8/10", 8/10).

{{
  "grammar": 0,
  "clarity": 0,
  "relevance": 0,
  "politeness": 0,
  "team_collaboration": 0,
  "overall": 0,
  "strengths": [],
  "improvements": [],
  "final_feedback": ""
}}
"""

    print("\n==============================")
    print("📊 GENERATING DISCUSSION FEEDBACK")
    print("==============================")

    result_text = safe_generate(evaluation_prompt, is_json=True)

    # Strip markdown code fences if present (```json ... ```)
    cleaned = result_text.strip()
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = cleaned.index("\n")
        cleaned = cleaned[first_newline + 1:]
        # Remove closing fence
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        raw_json = json.loads(cleaned)
        # ✅ FIX: Convert keys to lowercase safely so the frontend doesn't miss them
        result_json = {str(k).lower(): v for k, v in raw_json.items()}
        result_json["human_percentage"] = human_percentage
    except:
        print("⚠️ Could not parse JSON")
        print(result_text)
        return {"error": "Evaluation parsing failed"}

    print("\n📈 HUMAN PERFORMANCE METRICS")
    print("--------------------------------")
    print(f"Grammar: {result_json.get('grammar')}/10")
    print(f"Clarity: {result_json.get('clarity')}/10")
    print(f"Relevance: {result_json.get('relevance')}/10")
    print(f"Politeness: {result_json.get('politeness')}/10")
    print(f"Team Collaboration: {result_json.get('team_collaboration')}/10")
    print(f"Overall: {result_json.get('overall')}/10")
    print(f"Percentage of participation: {result_json.get('human_percentage')}%")
    print("\n💪 Strengths:")
    for s in result_json.get("strengths", []):
        print(f"- {s}")

    print("\n⚠️ Areas to Improve:")
    for i in result_json.get("improvements", []):
        print(f"- {i}")

    print("\n📝 Final Feedback:")
    print(result_json.get("final_feedback"))
    print("================================\n")

    # ✅ FIX: Safe DB saving. Won't crash and abort if columns (like interrupt_count) are missing!
    def parse_score(val):
        if isinstance(val, (int, float)): return int(val)
        if isinstance(val, str):
            import re
            m = re.search(r'\d+', val)
            return int(m.group()) if m else 0
        return 0

    try:
        db = SessionLocal()
        discussion = db.query(Discussion).filter(Discussion.id == int(sim_id)).first()
        if discussion:
            if hasattr(discussion, 'grammar_score'): discussion.grammar_score = parse_score(result_json.get("grammar"))
            if hasattr(discussion, 'clarity_score'): discussion.clarity_score = parse_score(result_json.get("clarity"))
            if hasattr(discussion, 'relevance_score'): discussion.relevance_score = parse_score(result_json.get("relevance"))
            if hasattr(discussion, 'politeness_score'): discussion.politeness_score = parse_score(result_json.get("politeness"))
            if hasattr(discussion, 'team_collaboration_score'): discussion.team_collaboration_score = parse_score(result_json.get("team_collaboration"))
            if hasattr(discussion, 'overall_score'): discussion.overall_score = parse_score(result_json.get("overall"))
            if hasattr(discussion, 'human_percentage'): discussion.human_percentage = parse_score(result_json.get("human_percentage"))
            if hasattr(discussion, 'human_interrupt_count'): discussion.human_interrupt_count = human_interrupt_count
            if hasattr(discussion, 'strengths'): discussion.strengths = json.dumps(result_json.get("strengths", []))
            if hasattr(discussion, 'improvements'): discussion.improvements = json.dumps(result_json.get("improvements", []))
            if hasattr(discussion, 'final_feedback'): discussion.final_feedback = result_json.get("final_feedback")
            db.commit()
            print("✅ Final evaluation saved to database")
        db.close()
    except Exception as e:
        print(f"⚠️ Could not save evaluation to DB: {e}")
        try:
            db.rollback()
        except:
            pass

    return result_json