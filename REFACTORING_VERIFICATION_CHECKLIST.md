# ✅ Sequential Discussion Logic - Implementation Checklist

## Pre-Testing Verification

Run these checks before starting functional tests:

### 1. Code Inspection

#### ✅ Speaking Order (Fixed)

```bash
# Command: Check that speaking_order doesn't use random
grep -n "random.sample\|random.randint\|HUMAN_TURN" backend/utils/gd_simulator.py

# Expected: NO results after refactoring
# If found: Refactoring incomplete
```

#### ✅ Generation Only On-Demand

```bash
# Command: Check for pre-generation patterns
grep -n "Pre-generating\|prepared_response\|pre-generate" backend/utils/gd_simulator.py

# Expected: Only in comments explaining removal, NOT in active code
```

#### ✅ Interrupt Check at Loop Start

```bash
# Command: Verify interrupt check location
grep -n "for agent in speaking_order" backend/utils/gd_simulator.py
grep -n -A 5 "for agent in speaking_order" backend/utils/gd_simulator.py | grep -n "interrupt_reserved"

# Expected: interrupt_reserved check appears within 5 lines of loop start
```

### 2. Syntax Validation

```bash
cd d:\BTECH\Project\Project1\backend
python -m py_compile utils/gd_simulator.py

# Expected: No output (compilation successful)
# If error: Python syntax issue
```

### 3. Backend Start Check

```bash
# Terminal 1: Start backend
cd d:\BTECH\Project\Project1\backend
uvicorn utils.gd_simulator:app --reload --port 8001

# Expected logs:
# INFO:     Application startup complete
# No errors about prepared_response or pre-generation
```

```bash
# Terminal 2: Health check
curl http://localhost:8001/health

# Expected response:
{
  "status": "ok",
  "speech_recognition": "Whisper (primary) + Vosk (fallback)",
  "whisper_loaded": true,
  "vosk_model_loaded": true,
  "ffmpeg_available": true,
  "vosk_model_path": "..."
}
```

---

## Functional Test Cases

### Test 1: Normal Round (Baseline)

**Objective:** Verify agents speak sequentially without interference

**Steps:**

1. Open frontend: `http://localhost:5173`
2. Login with test user
3. Select topic: "Digital Transformation"
4. Click "Start Discussion"
5. Let all agents speak without interrupting

**Expected Results:**

```
✅ Agent 1 audio plays (0-5 sec)
✅ Agent 2 audio plays (5-10 sec)
✅ Agent 3 audio plays (10-15 sec)
✅ Agent 4 audio plays (15-20 sec)
✅ No overlapping audio streams

Backend Logs:
💭 Agent 1 is thinking...
📝 Generating fresh response for Agent 1
🗣️ Agent 1: "[response]"

💭 Agent 2 is thinking...
📝 Generating fresh response for Agent 2
🗣️ Agent 2: "[response]"
```

**Verification:**

- [ ] No error messages in browser console
- [ ] No "pre-generation" messages in backend logs
- [ ] Each agent completes before next starts
- [ ] Backend logs show "Generating fresh response" for each agent

---

### Test 2: Single Interrupt (Mid-Round)

**Objective:** Verify interrupt skips agent's response and allows human input

**Steps:**

1. Start discussion (same as Test 1)
2. Agent 1 finishes
3. **CLICK INTERRUPT BUTTON** while Agent 2 is selected (or just before Agent 3)
4. Wait for recording prompt
5. Speak/type: "That's a good point, but we should consider..."
6. Submit or auto-stop recording

**Expected Results:**

```
✅ Interrupt button becomes inactive (shows "Next chance reserved")
✅ Backend logs: 🔔 Interrupt #1 reserved
✅ "Recording..." prompt appears on frontend

When human submits:
✅ Transcript appears: "You: That's a good point..."
✅ Agent 4 speaks next (acknowledging human input)
✅ Round completes normally

Backend Logs:
🔔 ==================================================
  INTERRUPT DETECTED - HUMAN GETS TURN
  ==================================================

👤 HUMAN INPUT RECEIVED
💬 HUMAN SAID: "That's a good point, but we should..."

💭 Agent 4 is thinking...
📝 Generating fresh response for Agent 4
🗣️ Agent 4: "[response acknowledging human]"
```

**Verification:**

- [ ] Agent 3's response NEVER appears (not in logs, not in transcript)
- [ ] Human interrupt count increases to 1
- [ ] No stale audio plays unexpectedly
- [ ] Agent 4 appears to acknowledge human point naturally

---

### Test 3: Multiple Interrupts (Different Agents)

**Objective:** Verify multiple interrupts across rounds work correctly

**Steps:**

1. Complete Test 2 (one interrupt in round 1)
2. Move to Round 2
3. Agent 1 finishes
4. **CLICK INTERRUPT BUTTON** again
5. Submit human response: "I'd like to add..."
6. Round continues
7. End discussion

**Expected Results:**

```
Round 1:
✅ Interrupt count: 1

Round 2:
✅ Interrupt button resets (enabled)
✅ **CLICK INTERRUPT BUTTON** sets interrupt_reserved=True
✅ Human speaks
✅ Interrupt count: 2
✅ Round completes

End Discussion:
✅ Feedback shows: "Human interrupts: 2"
✅ Database stores human_interrupt_count=2
```

**Verification:**

- [ ] Interrupt button available in Round 2
- [ ] Each interrupt increments counter
- [ ] Feedback page shows correct total
- [ ] Database query: `SELECT human_interrupt_count FROM discussions WHERE id=X` returns 2

---

### Test 4: Interrupt Timeout

**Objective:** Verify 120-second timeout prevents infinite wait

**Steps:**

1. Start discussion
2. Agent 1 finishes
3. **CLICK INTERRUPT BUTTON**
4. DO NOT submit human response
5. Wait 120+ seconds
6. Observe

**Expected Results:**

```
✅ Recording prompt appears
✅ Backend waits (logs show waiting)
✅ At ~120 seconds: "Timeout" error appears
✅ Agent 4 speaks without human input in this turn
✅ Round still completes

Frontend Display:
"Recording... (waiting for input)"
↓ 120 seconds pass ↓
"Error: Timeout waiting for human input"
↓ continues ↓
"Agent 4 is speaking..."
```

**Verification:**

- [ ] No infinite waiting/hanging
- [ ] Error message clear and user-friendly
- [ ] Discussion recovers gracefully
- [ ] Backend logs show timeout message

---

### Test 5: Performance & Audio Streams

**Objective:** Verify NO simultaneous audio generation

**Steps:**

1. Open browser DevTools (F12)
2. Go to Network tab
3. Start discussion
4. Watch API calls during agent speeches

**Expected Results:**

```
Network Timeline:
[Agent 1 audio request] ----████ (completes)
[Agent 2 audio request]         ----████ (starts after Agent 1 completes)
[Agent 3 audio request]             ----████
[Agent 4 audio request]                 ----████

✅ NO overlapping rectangles (no simultaneous requests)
✅ Each audio starts AFTER previous completes
✅ Clean sequential pattern
```

**Verification (Browser Console):**

```javascript
// Count active requests in Network tab
// Expected: 1 audio request at a time
// If 2+: Pre-generation still active (failed refactoring)
```

---

### Test 6: Text Input Mode (No Voice)

**Objective:** Verify interrupt works with text input too

**Steps:**

1. Start discussion
2. Let Agent 1, 2, 3 speak
3. **CLICK INTERRUPT BUTTON**
4. DON'T record voice - instead click "Type Instead" button
5. Type response: "I think we should..."
6. Submit

**Expected Results:**

```
✅ Text appears in transcript instead of voice
✅ Agent 4 responds naturally (acknowledges text)
✅ No audio generation errors
✅ Feedback still generated for text input

Backend Logs:
⌨️ Processing text input: 'I think we should...'
💬 HUMAN SAID: "I think we should..."
```

**Verification:**

- [ ] Text input works smoothly
- [ ] No "transcription failed" errors
- [ ] Agent acknowledges human point
- [ ] Feedback scores applied to text

---

## Log Inspection Checklist

### ✅ Good Signs (Successful Refactoring):

```
🔄 ROUND 1 STARTING
📢 Speaking order: ['Agent 1', 'Agent 2', 'Agent 3', 'Agent 4']
ℹ️ Human can interrupt anytime via button

💭 Agent 1 is thinking...
📝 Generating fresh response for Agent 1
🗣️ Agent 1: "[text]"

💭 Agent 2 is thinking...
📝 Generating fresh response for Agent 2
🗣️ Agent 2: "[text]"

🔔 INTERRUPT DETECTED - HUMAN GETS TURN
✅ Human submitted: "Their text"

💭 Agent 4 is thinking...
📝 Generating fresh response for Agent 4
🗣️ Agent 4: "[text]"

🎉 Round 1 completed!
```

### ❌ Bad Signs (Refactoring Incomplete):

```
⏳ Pre-generating response for Agent 2       ← PROBLEM!
♻️ Using prepared response for Agent 3        ← PROBLEM!
🔄 Prepared response discarded               ← PROBLEM!
random.sample                                 ← PROBLEM!
['Agent 1', 'You', 'Agent 2', 'Agent 3']   ← PROBLEM! (Human in order)
```

---

## Backend Log Monitoring

### Live Log Monitoring Command:

```bash
# In terminal where uvicorn is running:
# (Logs automatically display - watch for patterns above)

# Or tail logs from file if saving to file:
# tail -f backend.log | grep -E "(Pre-generating|prepared_response|INTERRUPT|Generating)"
```

### Search for Issues:

```bash
# Before full testing
git diff HEAD~1 backend/utils/gd_simulator.py | grep -E "(prepared_response|Pre-generating|random)"

# Should show REMOVED lines (with - prefix), not ADDED lines
```

---

## Database Verification

### Check Interrupt Count Storage:

```sql
-- After completing a discussion with 2 interrupts
SELECT id, topic, human_interrupt_count FROM discussions ORDER BY id DESC LIMIT 1;

-- Expected:
-- id | topic | human_interrupt_count
-- 5  | AI Ethics | 2
```

### Check Response Storage:

```sql
SELECT count(*) FROM human_responses WHERE discussion_id = 5;

-- Expected: 3 responses (2-3 per round, depending on interrupts)
-- If 0: Responses not saved (problem in code)
```

---

## Common Issues & Solutions

### Issue 1: Overlapping Audio Still Occurs

**Symptom:** Multiple agent voices play simultaneously

**Root Cause:** Pre-generation still active

**Check:**

```bash
grep -n "Pre-generating\|prepared_response" backend/utils/gd_simulator.py | wc -l
# Should be 0 (only in comments)
```

**Fix:** Ensure `generate()` function doesn't have pre-generation loop at end

---

### Issue 2: Interrupt Button Doesn't Work

**Symptom:** Button doesn't trigger interrupt, human can't speak

**Root Cause:** SSE `human_start` event not reaching frontend

**Check:**

```bash
# Browser DevTools → Network → WebSocket/SSE
# Look for event: {"type": "human_start"}
# If missing: Backend not sending event
```

**Verify:** Check that interrupt check triggers SSE yield:

```python
if sim["interrupt_reserved"]:
    yield f"data: {json.dumps({'type': 'human_start'})}\n\n"  # ← Must be here
```

---

### Issue 3: Human Context Missing

**Symptom:** Agent 4 doesn't mention human's point, response seems unrelated

**Root Cause:** Human utterance not added to `utterances` list before Agent 4 prompt generation

**Check:** In backend logs, verify:

```
💬 HUMAN SAID: "[text]"  ← Human input received
...
💭 Agent 4 is thinking...   ← Next agent starts AFTER human logged
```

**Verify:** `submit_human_input()` must add to utterances:

```python
sim["utterances"].append({
    "agent": "You",
    "text": human_text,
    "timestamp": time.time()
})
```

---

## Final Sign-Off

After all tests pass, mark complete:

- [ ] **Code Inspection** - No pre-generation code
- [ ] **Syntax Valid** - Python compiles successfully
- [ ] **Backend Starts** - No errors on startup
- [ ] **Test 1 Pass** - Normal round works
- [ ] **Test 2 Pass** - Single interrupt works
- [ ] **Test 3 Pass** - Multiple interrupts work
- [ ] **Test 4 Pass** - Timeout handled gracefully
- [ ] **Test 5 Pass** - No simultaneous audio
- [ ] **Test 6 Pass** - Text input works
- [ ] **Logs Clean** - No "pre-generation" messages
- [ ] **Database Updates** - Interrupt counts stored
- [ ] **No Errors** - Browser console clean
- [ ] **User Experience** - Clean turn-taking observed

---

## Ready for Production?

✅ **YES** if all 13 items are checked
❌ **NO** if any item is unchecked - debug that area

---

**Verification Date:** ******\_\_\_******
**Tested By:** ******\_\_\_******
**Status:** ** READY / ** NEEDS FIXES
