# 🔄 Sequential Discussion Logic Refactoring

## Executive Summary

The Group Discussion Simulator's backend has been refactored to **enforce strict sequential agent speaking** with dynamic human interrupts. The key changes eliminate simultaneous agent speech, remove random speaker ordering, and ensure clean interrupt handling.

**Status**: ✅ Refactoring Complete
**Version**: 2.0
**Date**: March 14, 2026

---

## Problem Statement (Original Issues)

### 1. **Multiple Agents Speaking Simultaneously**

- **Issue**: Agents were pre-generating responses in advance, causing multiple audio streams
- **Symptom**: Frontend heard overlapping agent voices

### 2. **Random Human Position in Speaking Order**

- **Issue**: `next_round()` inserted human randomly into the speaking order
- **Symptom**: Human sometimes scheduled before round started, no true interrupt capability

### 3. **Complex Pre-Generation Logic**

- **Issue**: System maintained `prepared_response` in simulation state, causing stale responses
- **Symptom**: If human interrupted, prepared response for next agent was outdated (human context missing)

### 4. **Duplicate Interrupt Handling**

- **Issue**: Both random insertion AND interrupt button tried to handle human turns
- **Symptom**: Conflicting logic paths, unclear when human would speak

---

## Solution Architecture

### 1. **Strict Sequential Speaking Order**

#### Before:

```python
# ❌ Random insertion of human into speaking order
all_speakers = agents.copy()
human_position = random.randint(0, len(all_speakers))
speaking_order = all_speakers[:human_position] + ["HUMAN_TURN"] + all_speakers[human_position:]
```

#### After:

```python
# ✅ Fixed sequential agent speaking, human only via interrupt
speaking_order = agents  # Always Agent 1, Agent 2, Agent 3, Agent 4
```

**Benefits:**

- Agents speak in predictable order each round
- No random re-ordering of speakers
- Human ONLY enters via interrupt button

### 2. **No Pre-Generation of Responses**

#### Before:

```python
# ❌ Pre-generated next agent while current agent still speaking
if sim["prepared_response"] and sim["prepared_response"]["agent"] == agent.name:
    text = sim["prepared_response"]["text"]
    audio_base64 = sim["prepared_response"]["audio"]
else:
    # Generate fresh response
    text = agent.generate_response(prompt)

# Later: Pre-generate next agent
sim["prepared_response"] = {
    "agent": next_agent.name,
    "text": next_text,
    "audio": next_audio_base64
}
```

#### After:

```python
# ✅ Generate response ONLY when agent's turn starts
yield f"data: {json.dumps({'type': 'agent_speaking', 'agent': agent.name})}\n\n"
prompt = agent.prepare_prompt(topic, utterances, is_first=..., human_just_spoke=human_just_spoke)
text = agent.generate_response(prompt)  # Generate NOW, not in advance
audio_base64 = text_to_audio_base64(text, agent.name)
```

**Benefits:**

- Only one agent response generated at a time
- Eliminates audio stream collision
- Next agent always sees updated context (including human interrupts)

### 3. **Interrupt Handling at Loop Start**

#### Before:

```python
# ❌ Check for interrupt in middle of agent processing
# After agent speaks, check if interrupt happened
if sim["interrupt_reserved"]:
    # Handle interrupt (but agent already spoke)
```

#### After:

```python
# ✅ Check for interrupt BEFORE agent speaks
for agent in speaking_order:
    if sim["interrupt_reserved"]:
        # Stop current loop, give turn to human
        # Then continue with next agent
        continue

    # NOW agent can speak (no interrupt pending)
    # Generate response
    # Send response
```

**Benefits:**

- Clean interrupt flow: agent → interrupt check → human (if interrupted) → next agent
- No stale prepared responses
- Human speaks BEFORE next agent's response is generated

---

## Code Changes Summary

### 1. **Simulation State Initialization** (`start_simulation` endpoint)

**Removed fields:**

- `prepared_response` - No longer needed
- `speaking_agent_index` - Not used

**Kept fields:**

- `interrupt_reserved` - For button click
- `human_interrupt_count` - For tracking
- `current_speaker` - For UI display

```python
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
```

### 2. **Speaking Order** (`next_round` endpoint)

**Before:**

```python
speaking_order = []
if human_participant:
    all_speakers = agents.copy()
    human_position = random.randint(0, len(all_speakers))
    speaking_order = all_speakers[:human_position] + ["HUMAN_TURN"] + all_speakers[human_position:]
else:
    speaking_order = random.sample(agents, len(agents))
```

**After:**

```python
# ✅ SPEAKING ORDER: FIXED SEQUENTIAL AGENTS ONLY (NO RANDOM, NO HUMAN)
speaking_order = agents  # Agents always speak in the same order each round
```

### 3. **Main Loop** (`generate()` function inside `next_round`)

**Complete refactor:**

```python
def generate():
    nonlocal utterances
    human_just_spoke = False

    for agent in speaking_order:
        # ✅ Step 1: Check for interrupt at START of loop
        if sim["interrupt_reserved"]:
            # Reset flag
            sim["interrupt_reserved"] = False

            # Signal human to speak
            yield f"data: {json.dumps({'type': 'human_start'})}\n\n"
            sim["awaiting_human"] = True

            # Wait for human input (max 120 seconds)
            # ... (rest of wait logic)

            # After human speaks, continue to next agent
            human_just_spoke = True
            continue

        # ✅ Step 2: Agent speaks (only when no interrupt)
        sim["current_speaker"] = agent.name
        yield f"data: {json.dumps({'type': 'agent_speaking', 'agent': agent.name})}\n\n"

        # ✅ Step 3: Generate response ONLY NOW (not in advance)
        prompt = agent.prepare_prompt(topic, utterances, is_first=..., human_just_spoke=human_just_spoke)
        text = agent.generate_response(prompt)
        audio_base64 = text_to_audio_base64(text, agent.name)

        # Add to utterances
        utterances.append({
            "agent": agent.name,
            "text": text,
            "audio": audio_base64,
            "timestamp": time.time()
        })

        # Send response
        yield f"data: {json.dumps({'type': 'response', 'agent': agent.name, 'text': text, 'audio': audio_base64})}\n\n"
        human_just_spoke = False

    # ✅ Round complete
    sim["current_round"] += 1
    yield f"data: {json.dumps({'type': 'complete', 'round': sim['current_round']})}\n\n"
```

**Key improvements:**

- Single loop over agents (no HUMAN_TURN)
- Interrupt checked at START of loop
- Generation happens only during agent's turn
- Clean sequential flow

### 4. **Human Input Submission** (`submit_human_input` endpoint)

**Removed:**

```python
# ❌ This logic no longer needed
if sim["interrupt_reserved"]:
    sim["prepared_response"] = None
    print("🔄 Prepared response discarded (interrupt occurred)")
```

**Result:** Cleaner endpoint, no stale data cleanup needed

---

## Expected Behavior After Refactoring

### Round Flow Example:

```
🎤 Round 1 Starting: [Agent 1, Agent 2, Agent 3, Agent 4]

1️⃣ Agent 1 Speaks
   → Agent 1 generates response
   → Frontend plays Agent 1 audio
   ✅ No pre-generation happening

2️⃣ Agent 2 Starts (Check for interrupt first)
   → interrupt_reserved = False → continue
   → Agent 2 generates response
   → Frontend plays Agent 2 audio
   ✅ Single speech stream

3️⃣ Agent 3 Starts (Check for interrupt first)
   → interrupt_reserved = True (user clicked button)
   → Reset flag = False
   ✅ Agent 3 response NEVER generated
   ✅ Send "human_start" event
   → Wait for human input (120 sec timeout)
   ← Human submits: "I think..."
   ✅ Send "human_response" event
   ✅ Continue to next agent

4️⃣ Agent 4 Speaks
   → Agent 4 generates response (sees human context in utterances)
   → Frontend plays Agent 4 audio
   ✅ Human context integrated naturally

🎉 Round 1 Complete
```

---

## SSE Event Stream

Client receives events in this order:

```
1. agent_speaking: "Agent 1"
2. response: Agent 1 text + audio
3. agent_speaking: "Agent 2"
4. response: Agent 2 text + audio
5. agent_speaking: "Agent 3"
6. human_start: (interrupt triggered)
7. human_response: Human text
8. agent_speaking: "Agent 4"
9. response: Agent 4 text + audio
10. complete: round=1
```

**Key insight**: `human_start` event appears INSTEAD OF the agent_speaking event for Agent 3.

---

## Database Changes

### Still Required:

- ✅ `human_interrupt_count` column in `Discussion` table - Already added

### Not Needed (Removed):

- ❌ No `prepared_response` table (was in-memory only)
- ❌ No `speaking_agent_index` field

### `/end_discussion` Endpoint:

- ✅ Already includes interrupt analysis in evaluation_prompt
- ✅ Stores `human_interrupt_count` to database

---

## Migration / Deployment Checklist

### ✅ Code Changes:

- [x] `start_simulation()` - Remove pre-generation fields
- [x] `next_round()` - Use fixed speaking order (no random, no HUMAN_TURN)
- [x] `generate()` - Check interrupt at loop start, no pre-generation
- [x] `submit_human_input()` - Remove prepared_response cleanup
- [x] Database model - Already has `human_interrupt_count`

### 🧪 Testing (See section below):

- [ ] Test Case 1: Normal round with all agents
- [ ] Test Case 2: Single interrupt during middle agent
- [ ] Test Case 3: Multiple interrupts across rounds
- [ ] Test Case 4: Human timeout handling
- [ ] Test Case 5: Feedback generation with interrupts

### 📦 Deployment:

1. Restart FastAPI backend: `uvicorn utils.gd_simulator:app --reload --port 8001`
2. Verify health check: `GET /health`
3. Test first simulation flow
4. Monitor backend logs for any "pre-generation" messages (should not appear)

---

## Testing Scenarios

### Test Case 1: Normal Round (No Interrupt)

**Setup:**

1. Start simulation
2. Load Round 1 (4 agents)

**Expected Flow:**

- Agent 1 speaks (generates response, sends audio)
- Agent 2 speaks (generates response, sends audio)
- Agent 3 speaks (generates response, sends audio)
- Agent 4 speaks (generates response, sends audio)
- Round completes

**Verify:**

- ✅ No overlapping audio
- ✅ SSE shows `agent_speaking` → `response` pattern
- ✅ Backend logs show single agent at a time
- ✅ No "pre-generate" or "prepared_response" logs

**Log Example:**

```
🔄 ROUND 1 STARTING
📢 Speaking order: ['Agent 1', 'Agent 2', 'Agent 3', 'Agent 4']
ℹ️ Human can interrupt anytime via button

💭 Agent 1 is thinking...
📝 Generating fresh response for Agent 1
🗣️ Agent 1: "[response text]"

💭 Agent 2 is thinking...
📝 Generating fresh response for Agent 2
🗣️ Agent 2: "[response text]"
```

---

### Test Case 2: Single Interrupt (During Agent 3)

**Setup:**

1. Start simulation
2. Round 1 loads
3. Agent 1 and 2 finish speaking
4. **Click interrupt button while Agent 2 is speaking (or between agents)**

**Expected Flow:**

- Agent 1 speaks
- Agent 2 speaks
- Check for interrupt → interrupt_reserved=True
- Skip Agent 3 response generation
- Send `human_start` event
- Frontend shows "Recording..." prompt
- Human speaks (simulated or real voice/text)
- Backend logs: `✅ Human submitted: "My point is..."`
- Agent 4 speaks (with human context in previous utterances)
- Round completes

**Verify:**

- ✅ Agent 3 response NEVER generated (no "Generating fresh response for Agent 3" log)
- ✅ Backend shows: `🔔 INTERRUPT DETECTED - HUMAN GETS TURN`
- ✅ Human interrupt count = 1
- ✅ Agent 4 sees human utterance in context
- ✅ No stale/outdated responses

**Log Example:**

```
💭 Agent 2 is thinking...
📝 Generating fresh response for Agent 2
🗣️ Agent 2: "[response text]"

🔔 ==================================================
  INTERRUPT DETECTED - HUMAN GETS TURN
  ==================================================

👤 HUMAN INPUT RECEIVED
📝 Processing text input: 'My point is that...'

💬 HUMAN SAID: "My point is that..."

✅ Human submitted: "My point is that..."

💭 Agent 4 is thinking...
📝 Generating fresh response for Agent 4
🗣️ Agent 4: "[response acknowledging human point]"
```

---

### Test Case 3: Multiple Interrupts

**Setup:**

1. Complete Round 1 with one interrupt
2. Move to Round 2
3. Interrupt again at different agent

**Expected Flow:**

- Round 1 completes with 1 interrupt
- Round 2 starts fresh
- New interrupt during different agent
- Interrupt count increments to 2
- Database records `human_interrupt_count=2` on end

**Verify:**

- ✅ Each interrupt increments counter
- ✅ No interference between rounds
- ✅ Feedback includes total interrupt count

---

### Test Case 4: Timeout Handling

**Setup:**

1. Start interrupt
2. Do NOT submit human input
3. Wait 120+ seconds

**Expected Flow:**

- Human button triggered interrupt
- `human_start` event sent
- Backend waits (120 sec timeout)
- Timeout occurs
- Backend sends: `{"type": "error", "message": "Timeout waiting for human input"}`
- Round continues without human input
- Agent 4 speaks without human utterance

**Verify:**

- ✅ No infinite hanging
- ✅ Timeout error sent to client
- ✅ Round recovers gracefully

---

### Test Case 5: Performance (No Simultaneous Audio)

**Setup:**

1. Monitor network tab in browser
2. Check audio stream count
3. Run full round

**Verify:**

- ✅ Only ONE audio stream at a time
- ✅ No overlapping `response` events with audio
- ✅ Agent 1 audio completes before Agent 2 audio starts
- ✅ No "buffered" audio streams

**Browser Dev Tools Check:**

```
Network Tab - Audio Requests:
1. /audio/agent1.m4a  (sent at T=0, completes at T=5)
2. /audio/agent2.m4a  (sent at T=5, completes at T=10)
3. /audio/agent3.m4a  (SKIPPED - interrupt)
4. /audio/agent4.m4a  (sent at T=8, completes at T=13)
   ✅ No overlap, no simultaneous requests
```

---

## Logs to Monitor

### ✅ Expected Logs (Refactoring Success):

```
🔄 ROUND 1 STARTING
📢 Speaking order: ['Agent 1', 'Agent 2', 'Agent 3', 'Agent 4']
💭 Agent 1 is thinking...
📝 Generating fresh response for Agent 1
🗣️ Agent 1: "[text]"
```

### ❌ Unexpected Logs (Old Behavior - Needs Fixing):

```
⏳ Pre-generating response for Agent 2  ← SHOULD NOT APPEAR
♻️ Using prepared response for Agent 3   ← SHOULD NOT APPEAR
🔄 Prepared response discarded           ← SHOULD NOT APPEAR
```

---

## Performance Impact

### Expected Results:

| Metric              | Before                   | After             | Change              |
| ------------------- | ------------------------ | ----------------- | ------------------- |
| Audio Streams       | Multiple (simultaneous)  | Single            | **✅ Cleaner**      |
| Response Generation | Pre-generated (wasteful) | On-demand         | **✅ Efficient**    |
| Memory Usage        | Stores prepared_response | Only current      | **✅ Lower**        |
| Context Accuracy    | Stale interrupts         | Fresh             | **✅ Better**       |
| User Experience     | Overlapping audio        | Clean turn-taking | **✅ Professional** |

---

## Rollback Plan

### If Critical Issue Found:

1. **Stop backend:** `Ctrl+C` on uvicorn terminal
2. **Revert to previous version:**
   ```bash
   git checkout HEAD~1 -- backend/utils/gd_simulator.py
   ```
3. **Restart:** `uvicorn utils.gd_simulator:app --reload --port 8001`
4. **Verify:** Check old behavior returns

---

## Next Steps

1. ✅ Review this document
2. 🧪 Run Test Case 1-5 above
3. 📝 Monitor backend logs for unexpected messages
4. 🚀 Deploy to production after testing
5. 📊 Monitor user feedback for audio improvements

---

## Summary of Files Modified

| File                                       | Changes                                          | Lines Changed |
| ------------------------------------------ | ------------------------------------------------ | ------------- |
| `backend/utils/gd_simulator.py`            | `start_simulation()` - removed prepared_response | ~4 lines      |
| `backend/utils/gd_simulator.py`            | `next_round()` - fixed speaking order            | ~15 lines     |
| `backend/utils/gd_simulator.py`            | `generate()` - complete refactor                 | ~100 lines    |
| `backend/utils/gd_simulator.py`            | `submit_human_input()` - removed cleanup         | ~3 lines      |
| `backend/models.py`                        | No changes needed                                | -             |
| `frontend/gd/src/pages/DiscussionPage.jsx` | No changes needed (already compatible)           | -             |

**Total:** ~122 lines of backend refactoring
**Database:** No schema migration needed (field already exists)
**Frontend:** Fully compatible with new SSE event flow

---

## Questions & Troubleshooting

### Q: Why remove pre-generation?

**A:** Pre-generation caused simultaneous audio streams. By generating on-demand, only one agent response exists at a time.

### Q: What if next agent takes a long time to respond?

**A:** That's expected. Gemini API calls take 1-3 seconds. Frontend will show "Agent X is thinking..." SSE event.

### Q: How does frontend know to stop recording?

**A:** Frontend monitors silence (3 seconds of quiet) and auto-stops. User can also click stop button.

### Q: What if human doesn't respond in 120 seconds?

**A:** Backend sends timeout error, round continues without human input. That speaking turn is skipped cleanly.

### Q: Can human interrupt multiple times per round?

**A:** Yes! Each interrupt click resets the flag. Round continues, human speaks again after next agent finishes.

### Q: Is the interrupt count stored permanently?

**A:** Yes! Stored in database table `Discussion.human_interrupt_count` for feedback analysis.

---

**Document Version:** 1.0
**Last Updated:** March 14, 2026
**Status:** ✅ COMPLETE - Ready for Testing
