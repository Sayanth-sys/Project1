# Interrupt System - Quick Start Testing Guide

## Pre-Flight Checklist

Before testing, ensure:

- [ ] Backend running: `python -m uvicorn main:app --reload --host 127.0.0.1 --port 8001`
- [ ] Frontend running: `npm run dev` (Port 5173)
- [ ] Database initialized
- [ ] Gemini API key configured (`.env`)
- [ ] Whisper/Vosk speech recognition available
- [ ] FFmpeg installed

---

## Test Scenario 1: Normal Discussion (No Interrupts)

### Steps:

1. Navigate to: http://localhost:5173
2. Click "Start Simulation"
3. Choose a discussion topic
4. Click "Start Simulation" button
5. Click "Next Round"
6. **Observe:** Agents speak in sequence
7. **When your turn comes:** Type or record a response
8. **Observe:** Next agent acknowledges your input
9. Click "Next Round" for Round 2
10. Click "End Discussion"

### Expected Behavior:

- ✅ Interrupt button is GRAY/DISABLED when agents speak (no reason to interrupt)
- ✅ Interrupt button is GRAY/DISABLED when it's your turn
- ✅ No interrupts registered in feedback
- ✅ Final feedback: `human_interrupt_count = 0`

---

## Test Scenario 2: Single Interrupt

### Steps:

1. Start simulation (same as above)
2. Click "Next Round"
3. **When Agent 1 starts speaking:**
   - 🔘 Interrupt button turns RED
   - Text reads: "🔔 Interrupt / Reserve Next Turn"
4. **Click the interrupt button**
   - Button turns YELLOW
   - Text reads: "🔔 Next chance reserved"
5. **Wait for Agent 2:**
   - Agent 2 will NOT speak
   - Recording auto-starts
   - Message appears: "You can talk now"
6. **Speak your response** (or type)
   - Speak naturally for 5-10 seconds
   - OR type your message
   - Recording auto-stops after 3 seconds of silence
7. **Agent 2 responds:**
   - Should acknowledge your interrupt
   - Response includes context from your input

### Expected Behavior:

- ✅ Button enabled = isAgentSpeaking && !interruptReserved
- ✅ Recording auto-starts when human_start received
- ✅ Silence detection stops recording at 3 seconds
- ✅ Next agent response regenerated fresh (prepared_response discarded)
- ✅ Backend logs show: `Interrupt #1 reserved`
- ✅ Backend shows: `Prepared response discarded (interrupt occurred)`

---

## Test Scenario 3: Multiple Interrupts

### Steps:

1. Start simulation
2. Click "Next Round"
3. **During Agent 1:** Click interrupt button
   - Button becomes YELLOW
4. **You speak** (interrupt payload delivered)
5. **During Agent 2:** Try clicking interrupt button again
   - ✅ Button should be ENABLED again (new agent speaking)
6. Click interrupt button again
   - Button turns YELLOW
7. **You speak again** (second interrupt)
8. Continue for remaining agents

### Expected Behavior:

- ✅ Each agent resets interrupt availability
- ✅ Button re-enables after human speaks
- ✅ Backend logs show: `Interrupt #1 reserved` → `Interrupt #2 reserved`
- ✅ Final feedback lists multiple interrupts with quality analysis

---

## Test Scenario 4: Voice Recording with Silence Detection

### Steps:

1. Start simulation → "Next Round"
2. Wait for your turn (scheduled or interrupt)
3. Recording auto-starts (or click "Record" button)
4. **Speak for 2 seconds, then pause for 4 seconds**
   - ✅ Recording should stop after 3 seconds of silence
5. **Alternatively, click "Stop Recording" button**
   - ✅ Recording stops immediately

### Expected Behavior:

- ✅ Red recording indicator appears
- ✅ Counter shows: "🎤 Recording: 0:05"
- ✅ After 3 seconds of NO speech, recording auto-stops
- ✅ Audio submitted to backend
- ✅ Transcribed text appears in discussion

---

## Test Scenario 5: Text Input with Interrupt

### Steps:

1. Start simulation → "Next Round"
2. Wait for your turn
3. If Whisper/Vosk unavailable:
   - Click "Send Text" button (no recording)
4. Type your response
5. Click "Send Text" OR press Enter

### Expected Behavior:

- ✅ Text recorded in discussion
- ✅ Backend processes as `submit_human_input`
- ✅ Prepared response still discarded if interrupted
- ✅ Next agent includes text in context

---

## Test Scenario 6: View Interrupt Feedback

### Steps:

1. Complete full discussion with interrupts
2. Click "End Discussion"
3. Navigate to Feedback page
4. **View feedback card**

### Expected Value:

```json
{
  "human_interrupt_count": 2,
  "team_collaboration": 8,
  "final_feedback": "...The human participant made 2 well-timed interrupts
    that added value to the discussion by bringing in alternative perspectives..."
}
```

### Expected Behavior:

- ✅ Interrupt count displayed in DB
- ✅ Feedback mentions interrupt quality
- ✅ Team collaboration score reflects interrupt effectiveness
- ✅ Final feedback analysis includes interrupt evaluation

---

## Test Scenario 7: Edge Case - Interrupt at Last Agent

### Steps:

1. Start simulation
2. Speaking order: Agent 1, Agent 2, Agent 3, [HUMAN_TURN]
3. Wait until Agent 3 is speaking
4. Click interrupt button
   - Agent 3 finishes
   - Prepared response (human turn) already discarded
   - Human gets immediate turn

### Expected Behavior:

- ✅ Works correctly even for last agent
- ✅ Human speaks without delay
- ✅ Interrupt recorded properly

---

## Test Scenario 8: Stress Test - Rapid Button Clicks

### Steps:

1. Start simulation → "Next Round"
2. When agent speaks, **click interrupt button 5 times rapidly**

### Expected Behavior:

- ✅ Button disabled after first click
- ✅ Only ONE interrupt registered
- ✅ State `interruptReserved = True` prevents duplicates
- ✅ No race conditions or double-interrupts

---

## Debugging Checklist

### Button not enabling?

```javascript
// Browser console (F12)
console.log({
  isAgentSpeaking,
  interruptReserved,
  isHumanSpeaking,
  simId,
});
```

All should be: `true, false, false, "123"` when agent speaks

### Recording not auto-starting?

```
Check SSE stream in Network tab (F12)
Should see: {"type":"human_start"}
Then: {"type":"recording_started",...}
```

### Silence detection not working?

```javascript
// Check browser console for errors
// Or manually click "Stop Recording" button
// Audio should still be submitted correctly
```

### Next agent not acknowledging interrupt?

```
Check backend logs:
Should show: "🔄 Prepared response discarded (interrupt occurred)"
Should show: "📝 Generating fresh response for Agent 2"
```

### Interrupt count not saved to DB?

```sql
-- In database console
SELECT human_interrupt_count FROM discussions WHERE id = 1;
-- Should show: 2 (or however many interrupts)
```

---

## Performance Benchmarks

| Action                       | Expected Time                    |
| ---------------------------- | -------------------------------- |
| Interrupt reservation        | <50ms                            |
| Auto-recording start         | <1s                              |
| Audio transcription          | 3-10s (Whisper) or 2-5s (Vosk)   |
| Prepared response generation | 2-4s (at end of previous agent)  |
| Fresh agent response         | 3-8s (on-demand after interrupt) |
| Silence detection loop       | 16ms per frame (60 FPS)          |

---

## Common Issues & Fixes

### Issue: "Recording failed - audio file is too small"

**Cause:** Recording was less than 1KB or silent

**Fix:**

- Speak louder
- Reduce microphone distance
- Increase silence threshold to 5000ms:
  ```javascript
  silenceThresholdRef.current = 5000;
  ```

### Issue: Interrupt button never appears

**Cause:** `isAgentSpeaking` never set to true

**Fix:**

- Check if `agent_speaking` event is received (Network tab)
- Verify backend sends event after agents start speaking
- Check browser console for SSE errors

### Issue: Next agent repeats previous agent's point

**Cause:** Context not properly updated OR prepared response used anyway

**Fix:**

- Verify backend shows: `♻️ Using prepared response` or `📝 Generating fresh response`
- Check if `interrupt_reserved` was properly reset to False
- Ensure human utterance added to `sim["utterances"]`

### Issue: 3-second silence not working

**Cause:** Web Audio API not available or error in monitorSilence()

**Fix:**

- Check if browser supports Web Audio API (most modern browsers do)
- Open DevTools Console, look for errors
- Use manual "Stop Recording" button as workaround

### Issue: Feedback shows 0 interrupts but I interrupted

**Cause:** Database not updated or feedback not recalculated

**Fix:**

- Check database: `SELECT human_interrupt_count FROM discussions WHERE id = 1;`
- Ensure `end_discussion()` endpoint was called
- Verify `main()` has auth check removed or user_id set correctly

---

## Console Log Indicators

### Successful Interrupt:

```
🔔 Requesting interrupt for: Agent 1
✅ Interrupt response: {success: true, interrupt_count: 1}
🔔 Interrupt #1 reserved!
```

### Auto-Recording Start:

```
🎤 Human turn triggered! Starting recording...
✅ Microphone access granted
🔴 Recording started with format: audio/webm;codecs=opus
```

### Silence Detected:

```
🔇 Silence detected after 3 seconds - stopping recording
🛑 Recording stopped. Total chunks: 15
📊 Audio blob size: 24576 bytes
📤 Submitting 24576 bytes audio to backend...
```

### Backend Processing:

```
💬 HUMAN SAID: "I think we should consider..."
🔄 Prepared response discarded (interrupt occurred)
📝 Generating fresh response for Agent 2
✅ Pre-generated: Agent 2
🗣️ Agent 2: "That's a great point about..."
```

---

## Success Indicators ✅

After running through all scenarios, you should see:

1. **Interrupt Button:**
   - Enables when agent speaks
   - Disables after click
   - Re-enables after human speaks (next agent)

2. **Recording:**
   - Auto-starts on human turn
   - Shows 3-second countdown
   - Stops on silence or manual click

3. **Context Integration:**
   - Next agent acknowledges your input
   - Discussion flows naturally
   - No repetition or confusion

4. **Data Persistence:**
   - Interrupt count in DB
   - Feedback includes analysis
   - Round-by-round scores recorded

5. **Error Handling:**
   - Graceful fallback to text input
   - No crashes on edge cases
   - Descriptive error messages

---

**All systems go! 🚀 Ready for production testing.**
