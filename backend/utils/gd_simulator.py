import random
import time
import concurrent.futures
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from typing import List, Dict
import json
from gtts import gTTS
import io
import base64
import os
from dotenv import load_dotenv

# -------------------------
# 🔐 Gemini Setup
# -------------------------
load_dotenv()
API_KEY = os.getenv("API_KEY")  # Set in backend/.env
genai.configure(api_key=API_KEY)
chat_model = genai.GenerativeModel("models/gemini-2.5-flash-preview-09-2025")

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
            "Agent 1": "co.in",   # Indian English
            "Agent 2": "com",     # US English
            "Agent 3": "co.uk",   # British English
            "Agent 4": "com.au"   # Australian English
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

# -------------------------
# 🗣️ Agent Class
# -------------------------
class Agent:
    def __init__(self, name, persona):
        self.name = name
        self.persona = persona

    def prepare_prompt(self, topic, utterances, is_first=False):
        full_discussion = "\n".join(
        f"- {u['agent']}: {u['text']}" for u in utterances
    )

        last_remark = utterances[-1]["text"] if utterances else ""
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
        return f"""
You are {self.name}, a participant in a group discussion.
Your style: {self.persona}.
Topic: {topic}

Discussion so far (for your awareness only, do NOT summarize or repeat it):
{full_discussion or "No prior remarks."}

Most recent comment (this is what you reply to):
"{last_remark}"

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
    allow_origins=["http://localhost:5173"],  # frontend origin
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

# -------------------------
# 🚀 API Endpoints
# -------------------------
@app.post("/start_simulation")
def start_simulation(req: SimulationRequest):
    print(f"\n[RECEIVED] Topic from frontend: {req.topic}\n")

    selected_personas = random.sample(PERSONAS, req.num_agents)
    agents = [Agent(f"Agent {i+1}", persona) for i, persona in enumerate(selected_personas)]
    sim_id = str(len(SIMULATIONS) + 1)
    SIMULATIONS[sim_id] = {
        "topic": req.topic,
        "agents": agents,
        "utterances": [],
        "current_round": 0,
        "total_rounds": req.rounds
    }

    print(f"[INFO] Started simulation {sim_id} with topic: {req.topic}")
    for a in agents:
        print(f"  {a.name}: {a.persona}")

    agent_list = [{"name": agent.name, "persona": agent.persona} for agent in agents]
    return {"simulation_id": sim_id, "agents": agent_list}

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

    speaking_order = random.sample(agents, len(agents))
    print(f"\n[INFO] Round {sim['current_round'] + 1} speaking order: {[a.name for a in speaking_order]}")

    def generate():
        for i, agent in enumerate(speaking_order):
            # Thinking status
            yield f"data: {json.dumps({'type': 'thinking', 'agent': agent.name})}\n\n"

            prompt = agent.prepare_prompt(topic, utterances, is_first=(sim["current_round"] == 0 and i == 0))
            text = agent.generate_response(prompt)

            # Convert to audio
            audio_base64 = text_to_audio_base64(text, agent.name)

            data = {"agent": agent.name, "text": text, "audio": audio_base64}
            utterances.append(data)

            # Send response with audio
            yield f"data: {json.dumps({'type': 'response', 'agent': agent.name, 'text': text, 'audio': audio_base64})}\n\n"
            print(f"[ROUND {sim['current_round']+1}] {agent.name}: {text}")

        sim["current_round"] += 1
        yield f"data: {json.dumps({'type': 'complete', 'round': sim['current_round']})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")