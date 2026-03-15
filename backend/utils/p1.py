from google import genai
import os
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("API_KEY"))

print("🔎 Listing available models...")
for model in client.models.list():
    print("MODEL:", model.name)
    # Don't access supported_generation_methods — it doesn't exist in this SDK