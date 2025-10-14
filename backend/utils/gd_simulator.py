#LAG ISSUE FIXED.
#!pip install -U google-generativeai sentence-transformers gtts mutagen

# import time
# import random
# import numpy as np
# import concurrent.futures
# from gtts import gTTS
# from IPython.display import Audio, display
# from sentence_transformers import SentenceTransformer
# import google.generativeai as genai
# from mutagen.mp3 import MP3
# from playsound import playsound


# # -------------------------
# # 🔐 Gemini Setup
# # -------------------------
# API_KEY = "AIzaSyCc2o4Yjl9hqFWwlE4RdZMyHmXZ-ICmpig"  # ✅ replace with your working Gemini API key
# genai.configure(api_key=API_KEY)

# chat_model = genai.GenerativeModel("models/gemini-2.5-flash-preview-09-2025")

# # -------------------------
# # 🧠 Embedding Model
# # -------------------------
# embedder = SentenceTransformer("all-MiniLM-L6-v2")

# # -------------------------
# # 🧍 Personas
# # -------------------------
# PERSONAS = [
#     "logical and fact-driven",
#     "supportive and encouraging",
#     "critical but respectful",
#     "creative and optimistic",
#     "cautious and balanced",
#     "structured and methodical"
# ]

# # -------------------------
# # 🧩 Helper Functions
# # -------------------------
# def get_embedding(text):
#     return embedder.encode(text)

# def cosine_similarity(a, b):
#     if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
#         return 0
#     return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# def get_relevant_context(utterances, topic, top_n=2):
#     if not utterances:
#         return ""
#     topic_emb = get_embedding(topic)
#     scored = [(cosine_similarity(topic_emb, u["embedding"]), u) for u in utterances]
#     scored.sort(reverse=True, key=lambda x: x[0])
#     return "\n".join([u["text"] for _, u in scored[:top_n]])

# def safe_generate(prompt, timeout=30):
#     """Safely call Gemini with timeout and handle errors."""
#     with concurrent.futures.ThreadPoolExecutor() as executor:
#         future = executor.submit(chat_model.generate_content, prompt)
#         try:
#             return future.result(timeout=timeout)
#         except concurrent.futures.TimeoutError:
#             print("[TIMEOUT] Gemini took too long.")
#             return None
#         except Exception as e:
#             print(f"[ERROR] During generation: {e}")
#             return None

# # -------------------------
# # 🗣️ Agent Class
# # -------------------------
# class Agent:
#     def __init__(self, name, persona):
#         self.name = name
#         self.persona = persona

#     def prepare_prompt(self, topic, utterances, is_first=False):
#         relevant_context = get_relevant_context(utterances, topic, top_n=3)
#         if is_first and not utterances:
#             return f"""
# You are {self.name}, a participant in a group discussion.
# Your style: {self.persona}.
# Topic: {topic}

# You are the first to speak.
# Start naturally with your viewpoint (under 80 words).
# """
#         else:
#             return f"""
# You are {self.name}, a participant in a group discussion.
# Your style: {self.persona}.
# Topic: {topic}

# Recent remarks:
# {relevant_context or "No prior remarks yet."}

# Respond naturally in under 80 words, staying consistent with your persona.
# """

#     def generate_response(self, prompt):
#         print(f"[DEBUG] {self.name} is calling Gemini...")
#         response = safe_generate(prompt)
#         print(f"[DEBUG] {self.name} got response.")
#         text = response.text.strip() if response and hasattr(response, "text") else "[No response from Gemini]"
#         return text

# # -------------------------
# # 🎮 GD Simulation
# # -------------------------
# def run_gd_simulation(topic, agents, rounds=2, skip_prob=0.25):
#     utterances = []
#     executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

#     for r in range(rounds):
#         print(f"\n=== Round {r+1} ===\n")
#         speaking_order = random.sample(agents, len(agents))
#         print(f"Speaking order: {[a.name for a in speaking_order]}\n")

#         future = None  # for overlapping request

#         for i, agent in enumerate(speaking_order):
#             if not (r == 0 and i == 0) and random.random() < skip_prob:
#                 print(f"{agent.name} stays silent.\n")
#                 continue

#             # prepare prompt
#             prompt = agent.prepare_prompt(topic, utterances, is_first=(r == 0 and i == 0))

#             # if previous future exists, play its audio while next request starts
#             if future:
#                 prev_data = future.result()  # wait only when needed
#                 play_audio_sequentially(prev_data, utterances)

#             # send Gemini request for next agent in background
#             future = executor.submit(generate_and_prepare_audio, agent, prompt)

#         # play last one after loop
#         if future:
#             last_data = future.result()
#             play_audio_sequentially(last_data, utterances)

#     executor.shutdown(wait=True)
#     print("\n=== ✅ GD Simulation Completed ===")

# # -------------------------
# # 🧩 Support Functions
# # -------------------------
# def generate_and_prepare_audio(agent, prompt):
#     text = agent.generate_response(prompt)
#     filename = f"{agent.name.replace(' ', '_')}.mp3"
#     try:
#         gTTS(text).save(filename)
#         emb = get_embedding(text)
#     except Exception as e:
#         print(f"[AUDIO ERROR] {e}")
#         emb = np.zeros(384)
#     return {"agent": agent.name, "text": f"{agent.name}: {text}", "embedding": emb, "file": filename}

# def play_audio_sequentially(data, utterances):
#     print(f"\n🗨️ {data['text']}\n")
#     playsound(data["file"])  # plays audio directly
#     utterances.append(data)

# # -------------------------
# # 🚀 Run Simulation
# # -------------------------
# topic = "Impact of Artificial Intelligence on Employment"
# selected_personas = random.sample(PERSONAS, 4)
# agents = [Agent(f"Agent {i+1}", persona) for i, persona in enumerate(selected_personas)]

# print("Assigned Personas:")
# for a in agents:
#     print(f"{a.name}: {a.persona}")

# run_gd_simulation(topic, agents, rounds=2)


import time
import random
import numpy as np
import concurrent.futures
from sentence_transformers import SentenceTransformer
import google.generativeai as genai

# -------------------------
# 🔐 Gemini Setup
# -------------------------
API_KEY = "AIzaSyCc2o4Yjl9hqFWwlE4RdZMyHmXZ-ICmpig"  # ✅ replace with your working Gemini API key
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
def get_embedding(text):
    return embedder.encode(text)

def cosine_similarity(a, b):
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def get_relevant_context(utterances, topic, top_n=2):
    if not utterances:
        return ""
    topic_emb = get_embedding(topic)
    scored = [(cosine_similarity(topic_emb, u["embedding"]), u) for u in utterances]
    scored.sort(reverse=True, key=lambda x: x[0])
    return "\n".join([u["text"] for _, u in scored[:top_n]])

def safe_generate(prompt, timeout=30):
    """Safely call Gemini with timeout and handle errors."""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(chat_model.generate_content, prompt)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            print("[TIMEOUT] Gemini took too long.")
            return None
        except Exception as e:
            print(f"[ERROR] During generation: {e}")
            return None

# -------------------------
# 🗣️ Agent Class
# -------------------------
class Agent:
    def __init__(self, name, persona):
        self.name = name
        self.persona = persona

    def prepare_prompt(self, topic, utterances, is_first=False):
        relevant_context = get_relevant_context(utterances, topic, top_n=3)
        if is_first and not utterances:
            return f"""
You are {self.name}, a participant in a group discussion.
Your style: {self.persona}.
Topic: {topic}

You are the first to speak.
Start naturally with your viewpoint (under 80 words).
"""
        else:
            return f"""
You are {self.name}, a participant in a group discussion.
Your style: {self.persona}.
Topic: {topic}

Recent remarks:
{relevant_context or "No prior remarks yet."}

Respond naturally in under 80 words, staying consistent with your persona.
"""

    def generate_response(self, prompt):
        print(f"[DEBUG] {self.name} is calling Gemini...")
        response = safe_generate(prompt)
        print(f"[DEBUG] {self.name} got response.")
        text = response.text.strip() if response and hasattr(response, "text") else "[No response from Gemini]"
        return text

# -------------------------
# 🎮 GD Simulation
# -------------------------
def run_gd_simulation(topic, agents, rounds=2, skip_prob=0.25):
    utterances = []
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

    for r in range(rounds):
        print(f"\n=== Round {r+1} ===\n")
        speaking_order = random.sample(agents, len(agents))
        print(f"Speaking order: {[a.name for a in speaking_order]}\n")

        future = None  # for overlapping request

        for i, agent in enumerate(speaking_order):
            if not (r == 0 and i == 0) and random.random() < skip_prob:
                print(f"{agent.name} stays silent.\n")
                continue

            prompt = agent.prepare_prompt(topic, utterances, is_first=(r == 0 and i == 0))

            if future:
                prev_data = future.result()
                display_text_response(prev_data, utterances)

            future = executor.submit(generate_text_response, agent, prompt)

        if future:
            last_data = future.result()
            display_text_response(last_data, utterances)

    executor.shutdown(wait=True)
    print("\n=== ✅ GD Simulation Completed ===")

# -------------------------
# 🧩 Support Functions
# -------------------------
def generate_text_response(agent, prompt):
    text = agent.generate_response(prompt)
    emb = get_embedding(text)
    return {"agent": agent.name, "text": f"{agent.name}: {text}", "embedding": emb}

def display_text_response(data, utterances):
    print(f"\n🗨️ {data['text']}\n")
    utterances.append(data)

# -------------------------
# 🚀 Run Simulation
# -------------------------
topic = "Impact of Artificial Intelligence on Employment"
selected_personas = random.sample(PERSONAS, 4)
agents = [Agent(f"Agent {i+1}", persona) for i, persona in enumerate(selected_personas)]

print("Assigned Personas:")
for a in agents:
    print(f"{a.name}: {a.persona}")

run_gd_simulation(topic, agents, rounds=2)
