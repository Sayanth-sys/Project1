from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import os
import google.generativeai as genai
from utils.gd_simulator import run_gd_simulation

load_dotenv()
API_KEY = os.getenv("GOOGLE_API_KEY")

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

app = Flask(__name__)
CORS(app)

@app.route("/simulate_gd", methods=["POST"])
def simulate_gd():
    data = request.json
    topic = data.get("topic", "General Discussion")
    rounds = data.get("rounds", 2)
    agents, conversation = run_gd_simulation(topic, model, rounds)
    return jsonify({
        "topic": topic,
        "agents": [{"name": agent.name, "persona": agent.persona} for agent in agents],
        "conversation": conversation
    })

if __name__ == "__main__":
    app.run(debug=True)
