from google import genai
import os
from dotenv import load_dotenv

load_dotenv()

client = genai.Client(api_key=os.getenv("API_KEY"))

print("🔎 Listing available models...\n")

for model in client.models.list():
    print("MODEL:", model.name)
    print("  Supported methods:", model.supported_generation_methods)
    print("-" * 50)