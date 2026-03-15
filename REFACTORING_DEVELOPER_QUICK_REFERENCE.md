# 🚀 Sequential Discussion Logic - Quick Reference Guide

## For Developers

This is a **quick lookup** guide for developers working with the refactored code.

---

## File Location

```
d:\BTECH\Project\Project1\backend\utils\gd_simulator.py
```

---

## Key Functions (In Order)

### 1. `start_simulation(req: SimulationRequest)`

**Line:** ~550-600  
**Purpose:** Initialize new discussion simulation  
**Changes:** Removed `prepared_response` and `speaking_agent_index` from SIMULATIONS dict

**Key State Variables:**

```python
SIMULATIONS[sim_id] = {
    "topic": ...,
    "agents": [...],              # List[Agent]
    "utterances": [],             # Full transcript
    "current_round": 0,           # Track round progress
    "total_rounds": 3,            # Configured rounds
    "human_participant": true,    # Boolean
    "awaiting_human": False,      # Set by submit_human_input()
    "interrupt_reserved": False,  # Set by /reserve_interrupt endpoint
    "human_interrupt_count": 0,   # Track interrupts
    "current_speaker": None       # Display purposes
}
```

---

### 2. `reserve_interrupt(sim_id: str)`

**Line:** ~680-715  
**Purpose:** Handle interrupt button click  
**Input:** Simulation ID from URL  
**Output:** JSON with success, interrupt_count

**Logic:**

```python
sim["interrupt_reserved"] = True  # ← Flags the check in generate()
sim["human_interrupt_count"] += 1 # Counter for feedback
```

**When It's Called:**

- User clicks "Interrupt / Reserve Next Turn" button
- Frontend sends: `POST /reserve_interrupt/{sim_id}`

---

### 3. `submit_human_input(sim_id: str, audio/text)`

**Line:** ~650-720  
**Purpose:** Accept human's voice/text input after interrupt  
**Input:** Either audio file OR text string  
**Output:** JSON with success and transcribed_text

**Logic:**

```python
human_text = transcribe_audio(audio) OR text
sim["utterances"].append({
    "agent": "You",
    "text": human_text,
    "timestamp": time.time()
})
sim["awaiting_human"] = False  # ← Signals generate() to continue
```

**When It's Called:**

- After user interrupts and recording starts
- User finishes speaking or clicks "Stop"
- Frontend sends: `POST /submit_human_input/{sim_id}` with audio/text

---

### 4. `next_round(sim_id: str)` → Streaming Response

**Line:** ~780-900  
**Purpose:** Main round execution (SSE streaming)  
**Changes:** Complete refactor of `generate()` inner function

**Speaking Order (NEW):**

```python
speaking_order = agents  # ✅ FIXED ORDER, always same each round
# NO random.sample()
# NO "HUMAN_TURN" string
# Human enters ONLY via interrupt button
```

**Main Loop (REFACTORED):**

```python
for agent in speaking_order:  # Loop through agents sequentially

    # STEP 1: Check for interrupt FIRST
    if sim["interrupt_reserved"]:
        sim["interrupt_reserved"] = False
        yield {"type": "human_start"}  # Signal frontend
        # ... wait for human input ...
        continue  # Skip to next agent

    # STEP 2: Signal agent is speaking
    yield {"type": "agent_speaking", "agent": agent.name}

    # STEP 3: Generate response NOW (on-demand, not in advance)
    prompt = agent.prepare_prompt(...)
    text = agent.generate_response(prompt)
    audio = text_to_audio_base64(text, agent.name)

    # STEP 4: Send response
    yield {"type": "response", "agent": ..., "text": ..., "audio": ...}

    # ✅ NO pre-generation after this!
```

**SSE Events Sent:**

```
agent_speaking    → Frontend: enable interrupt button
human_start       → Frontend: start recording
human_response    → Frontend: display human text
response          → Frontend: play agent audio
complete          → Frontend: round finished
error             → Frontend: show error (timeout, etc)
```

---

## SSE Streaming Sequence

### Normal Flow (No Interrupt):

```
client connects to GET /next_round/{sim_id}

server: agent_speaking (Agent 1)
client: enable interrupt button
server: response (Agent 1 audio)
client: play audio

server: agent_speaking (Agent 2)
server: response (Agent 2 audio)
client: play audio

server: agent_speaking (Agent 3)
server: response (Agent 3 audio)
client: play audio

server: agent_speaking (Agent 4)
server: response (Agent 4 audio)
client: play audio

server: complete
client: show "Round X completed"
```

### With Interrupt Flow:

```
server: agent_speaking (Agent 1)
server: response (Agent 1 audio)

server: agent_speaking (Agent 2)
server: response (Agent 2 audio)

[USER CLICKS INTERRUPT BUTTON]
frontend: POST /reserve_interrupt/{sim_id}
server: interrupt_reserved = True

server: (SKIP Agent 3 entirely - no agent_speaking event)
server: human_start  ← ✅ NEW!
client: start recording
frontend: POST /submit_human_input/{sim_id}
backend: awaiting_human = False
server: human_response
client: show human text

server: agent_speaking (Agent 4)
server: response (Agent 4 audio)

server: complete
```

---

## State Transitions

### Interrupt Flow:

```
INITIAL STATE:
├─ interrupt_reserved: False
├─ awaiting_human: False
└─ current_speaker: "Agent 2"

USER CLICKS INTERRUPT:
├─ POST /reserve_interrupt/{sim_id}
└─ interrupt_reserved: True ← Backend sets this

GENERATE LOOP DETECTS:
├─ if interrupt_reserved: (at start of loop)
├─ yield "human_start"
└─ awaiting_human: True ← Wait for user

USER SUBMITS VOICE/TEXT:
├─ POST /submit_human_input/{sim_id}
├─ append to utterances
└─ awaiting_human: False ← Resume loop

GENERATE LOOP RESUMES:
├─ continue to next agent
├─ Agent generates response (includes human context)
└─ Round continues normally
```

---

## Important Variables

### Per-Simulation State:

| Variable                | Type | Set By                               | Read By               |
| ----------------------- | ---- | ------------------------------------ | --------------------- |
| `interrupt_reserved`    | bool | `/reserve_interrupt`                 | `generate()` loop     |
| `awaiting_human`        | bool | `generate()`                         | `/submit_human_input` |
| `human_interrupt_count` | int  | `/reserve_interrupt`                 | `end_discussion()`    |
| `current_speaker`       | str  | `generate()`                         | Frontend (via status) |
| `utterances`            | list | `generate()` + `/submit_human_input` | Feedback evaluation   |

---

## API Endpoints (Refactoring-Relevant)

### POST `/reserve_interrupt/{sim_id}`

**Purpose:** User clicks interrupt button  
**Body:** Empty  
**Response:**

```json
{
  "success": true,
  "interrupt_reserved": true,
  "interrupt_count": 1,
  "message": "Next chance reserved"
}
```

### POST `/submit_human_input/{sim_id}`

**Purpose:** User submits voice/text after interrupt  
**Body:** FormData with `audio: File` OR `text: string`  
**Response:**

```json
{
  "success": true,
  "transcribed_text": "The human said this"
}
```

### GET `/next_round/{sim_id}`

**Purpose:** Stream agents + interruptible discussion  
**Response:** Server-Sent Events (streaming)  
**Events:**

- `{type: "agent_speaking", agent: "Agent 1"}`
- `{type: "response", agent: "Agent 1", text: "...", audio: "..."}`
- `{type: "human_start"}`
- `{type: "human_response", text: "..."}`
- `{type: "complete", round: 1}`

---

## Debugging Tips

### To Check If Refactoring Is Applied:

**Grep for old patterns (should NOT exist):**

```bash
grep -n "prepared_response" backend/utils/gd_simulator.py
# ✅ Should show ZERO results (or only in comments)

grep -n "HUMAN_TURN" backend/utils/gd_simulator.py
# ✅ Should show ZERO results

grep -n "Pre-generating" backend/utils/gd_simulator.py
# ✅ Should show ZERO results
```

**Grep for new patterns (should exist):**

```bash
grep -n "for agent in speaking_order" backend/utils/gd_simulator.py
# ✅ Should show 1-2 results (in generate function)

grep -n "if sim\[\"interrupt_reserved\"\]" backend/utils/gd_simulator.py | head -1
# ✅ Should show result at START of loop
```

---

### Backend Logs to Watch

**Good logs (expected):**

```
💭 Agent 1 is thinking...
📝 Generating fresh response for Agent 1
🗣️ Agent 1: "..."

💭 Agent 2 is thinking...
📝 Generating fresh response for Agent 2
🗣️ Agent 2: "..."

🔔 INTERRUPT DETECTED - HUMAN GETS TURN
👤 HUMAN INPUT RECEIVED
💬 HUMAN SAID: "..."

💭 Agent 4 is thinking...
📝 Generating fresh response for Agent 4
🗣️ Agent 4: "..."
```

**Bad logs (old behavior - needs fixing):**

```
⏳ Pre-generating response for Agent 2    ← PROBLEM!
♻️ Using prepared response for Agent 3    ← PROBLEM!
🔄 Prepared response discarded           ← PROBLEM!
```

---

## Performance Characteristics

### Response Generation:

```
Gemini API call: ~1-3 seconds
gTTS audio generation: ~0.5-1 second
Total per agent: ~2-4 seconds (sequential)

Before refactoring (parallel/pre-gen):
- Generated 2-3 responses in parallel
- Wasted API calls if interrupt occurred
- Created simultaneous audio streams

After refactoring:
- Generate 1 response at a time
- No wasted calls
- No simultaneous audio
```

---

## Code Patterns

### Reading interrupt state:

```python
if sim["interrupt_reserved"]:
    # Handle interrupt case
    sim["interrupt_reserved"] = False
    # ...continue...
```

### Adding to transcript:

```python
sim["utterances"].append({
    "agent": "Agent 1",
    "text": "Response text",
    "audio": base64_audio,
    "timestamp": time.time()
})
```

### Waiting for human:

```python
sim["awaiting_human"] = True
max_wait = 120
waited = 0
while sim["awaiting_human"] and waited < max_wait:
    time.sleep(1)
    waited += 1
```

### Sending SSE events:

```python
yield f"data: {json.dumps({'type': 'agent_speaking', 'agent': agent.name})}\n\n"
yield f"data: {json.dumps({'type': 'response', 'text': text, 'audio': audio})}\n\n"
```

---

## Common Tasks

### Add a new agent interaction:

1. Agent already loops in `generate()`
2. Just call `agent.generate_response(prompt)`
3. Yield SSE event with response
4. That's it! (no pre-generation needed)

### Handle error during interrupt:

```python
if not sim["awaiting_human"]:
    yield f"data: {json.dumps({'type': 'error', 'message': 'Could not start recording'})}\n\n"
    # Continue with next agent or retry
```

### Add logging:

```python
print(f"🎯 YOUR MESSAGE HERE")
# Backend logs show immediately (good for debugging)
```

---

## Migration from Old to New

If you're familiar with the old code:

| Old                          | New            | Why                       |
| ---------------------------- | -------------- | ------------------------- |
| `sim["prepared_response"]`   | ❌ Removed     | Causes stale responses    |
| `random.sample(agents)`      | ✅ `agents`    | Fixed order, predictable  |
| `"HUMAN_TURN"` in loop       | ❌ Removed     | Interrupt only via button |
| Pre-generation loop          | ❌ Removed     | Wasteful, causes overlap  |
| Interrupt after agent speaks | ✅ Before loop | Prevents generation       |
| Clean up in submit           | ❌ Removed     | Not needed anymore        |

---

## Quick Testing

### Test 1: Check Syntax

```bash
python -m py_compile backend/utils/gd_simulator.py
# No output = success
```

### Test 2: Start Server

```bash
cd backend
uvicorn utils.gd_simulator:app --reload --port 8001
# Check "/health" endpoint works
```

### Test 3: Watch Logs

```bash
# In another terminal while running simulation:
# Look for these patterns in backend logs:
# - "Generating fresh response for Agent X" appears 4 times
# - "INTERRUPT DETECTED" appears 0 times (unless user clicks)
# - No "Pre-generating" messages
```

---

## File References

### Related Files (Read-Only):

- `backend/models.py` - Discussion model with `human_interrupt_count`
- `backend/main.py` - Auth endpoints
- `frontend/gd/src/pages/DiscussionPage.jsx` - Interrupt button, SSE handlers

### Configuration:

```python
# In gd_simulator.py:
SIMULATIONS = {}  # In-memory dictionary (not persistent)
# Survives for application lifetime
# Clears on server restart

# Whisper + Vosk:
# Loaded at startup from models in backend/utils/
```

---

## Rollback Process

If critical bug found:

```bash
# 1. Stop server
Ctrl+C

# 2. Revert file
git checkout HEAD~1 -- backend/utils/gd_simulator.py

# 3. Restart
uvicorn utils.gd_simulator:app --reload --port 8001

# 4. Test old behavior returns
```

---

## Useful Commands

### View current function:

```bash
grep -n "def generate" backend/utils/gd_simulator.py
# Shows function line number
```

### Check for syntax errors:

```bash
python -m py_compile backend/utils/gd_simulator.py
```

### Count lines of code:

```bash
wc -l backend/utils/gd_simulator.py
```

### Search for specific pattern:

```bash
grep -n "nonlocal utterances" backend/utils/gd_simulator.py
# Shows where utterances is modified
```

---

## Key Insight

**The biggest change:** Interrupt is now checked at the **START** of each loop iteration, BEFORE generating that agent's response.

```python
# ✅ NEW PATTERN:
for agent in speaking_order:
    if INTERRUPT_FLAG:
        handle_interrupt_and_skip_this_agent()
        continue
    generate_and_send_response()
```

This ensures interrupted agents never speak.

---

**Quick Reference Version:** 1.0  
**Last Updated:** March 14, 2026  
**For:** Developers working with refactored code
