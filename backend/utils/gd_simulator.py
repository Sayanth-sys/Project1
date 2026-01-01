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
import speech_recognition as sr
from pydub import AudioSegment

# -------------------------
# 🔐 Gemini Setup
# -------------------------
load_dotenv()
API_KEY = os.getenv("API_KEY")
genai.configure(api_key=API_KEY)
chat_model = genai.GenerativeModel("models/gemini-2.5-flash-preview-09-2025")

# Set FFmpeg path if you have it in a custom location
# Uncomment and modify if you extracted FFmpeg to a custom folder:
# os.environ["PATH"] += os.pathsep + r"C:\Users\HP\ffmpeg\bin"

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

def transcribe_audio(audio_file):
    """Convert audio file to text - NO FFmpeg required (with fallback)."""
    temp_path = None
    wav_path = None
    
    try:
        recognizer = sr.Recognizer()
        
        # Read the audio file
        audio_data = audio_file.read()
        audio_file.seek(0)
        
        print(f"[DEBUG] 🎤 Received audio file: {len(audio_data)} bytes")
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as temp_audio:
            temp_audio.write(audio_data)
            temp_path = temp_audio.name
        
        try:
            # Try direct recognition (works if browser sends compatible format)
            print("[DEBUG] 🔄 Attempting direct recognition...")
            with sr.AudioFile(temp_path) as source:
                audio_content = recognizer.record(source)
                text = recognizer.recognize_google(audio_content)
                print(f"[DEBUG] ✅ Transcribed: '{text}'")
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)
                return text
        except Exception as direct_error:
            print(f"[DEBUG] ⚠️ Direct recognition failed: {direct_error}")
            
            # Fallback: Try with pydub (requires FFmpeg)
            try:
                print("[DEBUG] 🔄 Trying format conversion with pydub...")
                audio = AudioSegment.from_file(temp_path)
                wav_path = temp_path.replace('.webm', '.wav')
                audio.export(wav_path, format="wav")
                
                with sr.AudioFile(wav_path) as source:
                    audio_content = recognizer.record(source)
                    text = recognizer.recognize_google(audio_content)
                    print(f"[DEBUG] ✅ Transcribed (converted): '{text}'")
                    
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)
                if wav_path and os.path.exists(wav_path):
                    os.remove(wav_path)
                return text
            except Exception as convert_error:
                print(f"[ERROR] ❌ Conversion failed: {convert_error}")
                print("[ERROR] 💡 FFmpeg not found! Please install FFmpeg or use text input")
                print("[ERROR] 💡 Download FFmpeg from: https://www.gyan.dev/ffmpeg/builds/")
                if temp_path and os.path.exists(temp_path):
                    os.remove(temp_path)
                if wav_path and os.path.exists(wav_path):
                    os.remove(wav_path)
                return None
            
    except sr.UnknownValueError:
        print("[ERROR] ❌ Could not understand audio - speech unclear")
        return None
    except sr.RequestError as e:
        print(f"[ERROR] ❌ Speech recognition service error: {e}")
        return None
    except Exception as e:
        print(f"[ERROR] ❌ Transcription failed: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        # Cleanup temporary files
        try:
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)
        except:
            pass

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
        
        # Special handling if human just spoke
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
        print("🎤 Processing voice input...")
        human_text = transcribe_audio(audio.file)
    elif text:
        print(f"⌨️  Processing text input: '{text}'")
        human_text = text
    
    if not human_text:
        print("❌ ERROR: Could not understand input")
        return {"error": "Could not understand input. Please try using text input instead."}
    
    print(f"\n💬 HUMAN SAID: \"{human_text}\"")
    print(f"{'='*60}\n")
    
    # Add human utterance to discussion
    sim["utterances"].append({
        "agent": "You",
        "text": human_text,
        "audio": None  # No audio playback for human
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

    # Create speaking order with human participant
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
                
                # Signal frontend that it's human's turn
                yield f"data: {json.dumps({'type': 'human_turn'})}\n\n"
                sim["awaiting_human"] = True
                
                # Wait for human input
                max_wait = 120
                waited = 0
                while sim["awaiting_human"] and waited < max_wait:
                    time.sleep(1)
                    waited += 1
                
                if waited >= max_wait:
                    print("⏰ TIMEOUT: Human took too long to respond")
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Timeout waiting for human input'})}\n\n"
                    continue
                
                # Send human's input to frontend
                human_utterance = sim["utterances"][-1]
                print(f"✅ Human response submitted: \"{human_utterance['text']}\"")
                yield f"data: {json.dumps({'type': 'human_response', 'text': human_utterance['text']})}\n\n"
                human_just_spoke = True
                
            else:
                # AI Agent's turn
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
        "utterances_count": len(sim["utterances"])
    }