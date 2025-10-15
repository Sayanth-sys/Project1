import time
import random
import concurrent.futures
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from typing import List, Dict

# -------------------------
# 🔐 Gemini Setup
# -------------------------
API_KEY = "AIzaSyCc2o4Yjl9hqFWwlE4RdZMyHmXZ-ICmpig"  # Replace with your working Gemini API key
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
    """Call Gemini safely with timeout and detailed debugging."""
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

# -------------------------
# 🗣️ Agent Class
# -------------------------
class Agent:
    def __init__(self, name, persona):
        self.name = name
        self.persona = persona

    def prepare_prompt(self, topic, utterances, is_first=False):
        context = "\n".join([u["text"] for u in utterances[-2:]])
        if is_first and not utterances:
            return f"""
You are {self.name}, a participant in a group discussion.
Your style: {self.persona}.
Topic: {topic}

You are the first to speak. Start naturally with your viewpoint (under 80 words).
"""
        return f"""
You are {self.name}, a participant in a group discussion.
Your style: {self.persona}.
Topic: {topic}

Recent remarks:
{context or 'No prior remarks yet.'}

Respond naturally in under 80 words, staying consistent with your persona.
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
    allow_origins=["http://localhost:5173"],  # ✅ correct CORS for Vite
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
    # ✅ Print topic received from frontend
    print(f"\n[RECEIVED] Topic from frontend: {req.topic}\n")

    selected_personas = random.sample(PERSONAS, req.num_agents)
    agents = [Agent(f"Agent {i+1}", persona) for i, persona in enumerate(selected_personas)]
    sim_id = str(len(SIMULATIONS) + 1)
    SIMULATIONS[sim_id] = {
        "topic": req.topic,  # ✅ use frontend topic
        "agents": agents,
        "utterances": [],
        "current_round": 0,
        "total_rounds": req.rounds
    }

    print(f"[INFO] Started simulation {sim_id} with topic: {req.topic}")
    for a in agents:
        print(f"  {a.name}: {a.persona}")

    return {"simulation_id": sim_id, "agents": [{a.name: a.persona} for a in agents]}

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
    round_responses = []

    speaking_order = random.sample(agents, len(agents))
    print(f"\n[INFO] Round {sim['current_round'] + 1} speaking order: {[a.name for a in speaking_order]}")
    for i, agent in enumerate(speaking_order):
        prompt = agent.prepare_prompt(topic, utterances, is_first=(sim["current_round"] == 0 and i == 0))
        text = agent.generate_response(prompt)
        data = {"agent": agent.name, "text": text}
        utterances.append(data)
        round_responses.append(data)
        print(f"[ROUND {sim['current_round']+1}] {agent.name}: {text}")

    sim["current_round"] += 1
    return {"round": sim["current_round"], "responses": round_responses}
