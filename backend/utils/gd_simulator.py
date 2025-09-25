import random
import google.generativeai as genai

PERSONAS = [
    "logical and fact-driven",
    "supportive and encouraging",
    "critical but respectful",
    "creative and optimistic",
    "cautious and balanced",
    "structured and methodical"
]

class Agent:
    def __init__(self, name, persona, model):
        self.name = name
        self.persona = persona
        self.model = model

    def speak(self, topic, conversation_history, is_first=False):
        if is_first and not conversation_history.strip():
            prompt = f"""
You are {self.name}, a participant in a group discussion.
Your discussion style: {self.persona}.
Topic: {topic}

Start the discussion naturally (under 80 words).
"""
        else:
            prompt = f"""
You are {self.name}, a participant in a group discussion.
Your discussion style: {self.persona}.
Topic: {topic}

Conversation so far:
{conversation_history}

Respond naturally and concisely (under 80 words).
"""
        response = self.model.generate_content(prompt)
        return response.text.strip()


def run_gd_simulation(topic, model, rounds=1):
    selected_personas = random.sample(PERSONAS, 4)
    agents = [Agent(f"Agent {i+1}", persona, model) for i, persona in enumerate(selected_personas)]
    conversation_history = ""
    full_conversation = []
    for r in range(rounds):
        for i, agent in enumerate(agents):
            text = agent.speak(topic, conversation_history, is_first=(i==0 and r==0))
            conversation_history += f"{agent.name}: {text}\n"
            full_conversation.append({"agent": agent.name, "text": text})
    return agents, full_conversation
