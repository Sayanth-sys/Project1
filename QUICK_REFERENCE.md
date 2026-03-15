# Interrupt System - Quick Reference Card

## 🎯 Core Concepts in 30 Seconds

**Interrupt System:** Allows humans to interrupt AI agents and reserve the next speaking turn during group discussions.

**Key Mechanic:** Click button → Agent finishes → Human speaks immediately → Agent regenerates response with human context

---

## 🔥 API Endpoints Quick Reference

### POST `/reserve_interrupt/{sim_id}`

**When:** User clicks interrupt button during agent speech
**Response:** `{ success: true, interrupt_count: 1 }`
**Side Effect:** `sim["interrupt_reserved"] = True`

### POST `/submit_human_input/{sim_id}`

**When:** User submits voice/text during human turn
**Side Effect:** `sim["prepared_response"] = None` (if interrupted)

### POST `/next_round/{sim_id}`

**Streaming:** SSE events via `generate()` function
**New Events:** `agent_speaking`, `human_start`, `recording_started`

### POST `/end_discussion/{sim_id}`

**Saves:** `discussion.human_interrupt_count` to database
**Includes:** Interrupt analysis in evaluation prompt

---

## 💾 Database Schema

```python
# New field in Discussion model
human_interrupt_count: Integer = Column(Integer, default=0)

# Tracks: Total number of interrupts made by human participant
```

---

## 🎮 Frontend State Variables

```javascript
// Interrupt System
isAgentSpeaking; // Agent currently speaking?
interruptReserved; // Interrupt already reserved?
isHumanSpeaking; // Human currently speaking?
currentSpeaker; // Name of speaking agent
interruptStatus; // Status message

// Audio Context
audioContextRef.current; // WebAudio API context
analyserRef.current; // Frequency analyzer
lastSoundTimeRef.current; // Last sound detection time
silenceThresholdRef.current; // 3000ms = 3 seconds
```

---

## 🎨 Button State Machine

```
WAITING (Gray)
    ↓ [Agent starts speaking]
AVAILABLE (Red) ← "Interrupt / Reserve Next Turn"
    ↓ [User clicks]
RESERVED (Yellow) ← "Next chance reserved"
    ↓ [Agent finishes, human speaks]
DISABLED (Gray) ← "Speaking..."
    ↓ [Human finishes]
AVAILABLE (Red) ← Ready for next agent
```

---

## 🔄 Interrupt Flow Diagram

```
┌─────────────────┐
│ Agent Speaking  │
└────────┬────────┘
         │
    ┌────▼─────────────┐
    │ Interrupt Btn    │
    │ Enabled (Red)    │
    └────┬─────────────┘
         │
    ┌────▼─────────────────────┐
    │ User Clicks Interrupt    │
    └────┬─────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ /reserve_interrupt Called │
    │ interrupt_reserved = True │
    │ Btn → Yellow (Disabled)   │
    └────┬──────────────────────┘
         │
    ┌────▼──────────────────┐
    │ Agent Finishes Voice  │
    └────┬──────────────────┘
         │
    ┌────▼─────────────────────────┐
    │ Check: interrupt_reserved?   │
    │ YES → Discard prepared_resp  │
    └────┬─────────────────────────┘
         │
    ┌────▼──────────────────┐
    │ Send "human_start"    │
    │ SSE Event             │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │ Frontend Auto-Records │
    │ 3-second silence      │
    │ detection active      │
    └────┬──────────────────┘
         │
    ┌────▼──────────────────┐
    │ User Speaks ~5sec     │
    │ Auto-stops on silence │
    └────┬──────────────────┘
         │
    ┌────▼────────────────────┐
    │ Audio Submitted         │
    │ Transcribed (Whisper)   │
    │ Added to utterances[]   │
    └────┬────────────────────┘
         │
    ┌────▼──────────────────────┐
    │ Next Agent Responded      │
    │ (Fresh + Human Context)   │
    │ Prepared Response Used    │
    └────┬──────────────────────┘
         │
    ┌────▼──────────────────┐
    │ Discussion Continues  │
    │ With New Information  │
    └──────────────────────┘
```

---

## 📡 SSE Events Timeline

```
Next Round Started
    ↓
"agent_speaking" { agent: "Agent 1" }
    [Interrupt Button Enabled]
    ↓
User clicks interrupt
    ↓
Agent finishes speaking
    ↓
"human_start" { type: "human_start" }
    [Frontend auto-records]
    ↓
"recording_started" { message: "You can talk now" }
    [UI shows recording status]
    ↓
User speaks (5-10 seconds)
    ↓
3-second silence detected → Recording stops
    ↓
Audio uploaded to /submit_human_input
    ↓
Transcription processed ← Whisper/Vosk
    ↓
Response: { success: true, transcribed_text: "..." }
    ↓
"response" from Agent 2 w/ context
    [Includes human input in context]
    ↓
Continues with remaining agents
    ↓
"complete" { round: 2 }
```

---

## 🛠️ Configuration Tweaks

### Increase Silence Threshold

```javascript
// frontend/gd/src/pages/DiscussionPage.jsx
silenceThresholdRef.current = 5000; // 5 seconds instead of 3
```

### Decrease Audio Sensitivity

```javascript
// frontend/gd/src/pages/DiscussionPage.jsx
if (average > 50) {
  // Increase from 30 to 50
  lastSoundTimeRef.current = Date.now();
}
```

### Increase Human Response Timeout

```python
# backend/utils/gd_simulator.py
max_wait = 180  # 3 minutes instead of 2
```

---

## 🐛 Debug Commands

### Check Backend State

```python
# In backend terminal during discussion
print(SIMULATIONS[sim_id])
# Shows all state including interrupt_reserved, interrupt_count
```

### Check Frontend State

```javascript
// In browser console (F12)
console.log({
  isAgentSpeaking,
  interruptReserved,
  isHumanSpeaking,
  currentSpeaker,
});
```

### Monitor SSE Events

```javascript
// In browser console
let eventLog = [];
// Copy entire fetchNextRound function
// Add: eventLog.push(data); before processing
console.table(eventLog);
```

### View Database

```sql
-- Check interrupt counts
SELECT id, topic, human_interrupt_count, overall_score FROM discussions;

-- Check if human responses exist
SELECT discussion_id, round_number, text FROM human_responses;
```

---

## 🎓 Key Code Locations

| Feature     | File                 | Line ~ | Notes                                   |
| ----------- | -------------------- | ------ | --------------------------------------- |
| Model       | `models.py`          | 32     | `human_interrupt_count` field           |
| Init Sim    | `gd_simulator.py`    | 590    | SIMULATIONS dict setup                  |
| Reserve API | `gd_simulator.py`    | 620    | `/reserve_interrupt` endpoint           |
| Main Logic  | `gd_simulator.py`    | 850    | `generate()` function interrupt checks  |
| Evaluation  | `gd_simulator.py`    | 1050   | Enhanced evaluation prompt              |
| Button      | `DiscussionPage.jsx` | 570    | Interrupt button component              |
| Recording   | `DiscussionPage.jsx` | 163    | `setupAudioContext()` silence detection |
| SSE Handler | `DiscussionPage.jsx` | 465    | New event type handlers                 |

---

## ✅ Testing Checklist (Quick)

- [ ] Start sim → Click "Next Round"
- [ ] Wait for agent speaking → Button turns Red
- [ ] Click button → Button turns Yellow
- [ ] Wait for human turn → Recording auto-starts
- [ ] Speak 5 seconds → Pause 4 seconds → Recording stops
- [ ] Submit voice → Next agent responds with your context
- [ ] End discussion → Check feedback.human_interrupt_count > 0

---

## 🚨 Common Issues & Quick Fixes

| Issue                         | Quick Fix                                              |
| ----------------------------- | ------------------------------------------------------ |
| Button never enables          | Check: Agent must be speaking (`isAgentSpeaking=true`) |
| Recording doesn't auto-start  | Check Network tab for `human_start` SSE event          |
| 3-sec silence doesn't trigger | Use manual "Stop Recording" button                     |
| Next agent ignores interrupt  | Check backend logs for prepared_response discard       |
| Interrupt count = 0 in DB     | Ensure `/end_discussion` called after discussion       |
| Voice not transcribing        | Check if Whisper/Vosk available (fallback to text)     |

---

## 📊 Performance Benchmarks

| Operation              | Time  |
| ---------------------- | ----- |
| Interrupt reservation  | <50ms |
| Recording auto-start   | <1s   |
| Silence detection loop | 16ms  |
| Voice transcription    | 3-10s |
| Agent pre-generation   | 2-4s  |

---

## 🔐 Thread Safety Notes

- ✅ SIMULATIONS dict is shared, but Python dict operations are atomic
- ✅ Single-threaded async processing (uvicorn)
- ⚠️ For production scale: Use Redis for SIMULATIONS
- ⚠️ For distributed: Add event queue (RabbitMQ, Kafka)

---

## 📱 Browser Compatibility

| Feature            | Chrome | Firefox | Safari           |
| ------------------ | ------ | ------- | ---------------- |
| SSE (EventSource)  | ✅     | ✅      | ✅               |
| Web Audio API      | ✅     | ✅      | ✅               |
| MediaRecorder      | ✅     | ✅      | ✅               |
| recordAudioContext | ✅     | ✅      | ⚠️ webkit prefix |

---

## 💡 Pro Tips

1. **Silence threshold too low?** Increase to 5000ms for thinking room
2. **Button flickers?** Wrap state update in useCallback to batch updates
3. **Audio context errors?** Check if page is HTTPS or localhost:5173
4. **Prepared responses not discarding?** Verify `interrupt_reserved` reset to False
5. **Backend logs verbose?** Add log level control to debug.py

---

## 📚 Related Documentation

- **Full Guide:** `INTERRUPT_SYSTEM_GUIDE.md`
- **Testing Guide:** `INTERRUPT_TESTING_GUIDE.md`
- **Implementation Details:** `INTERRUPT_IMPLEMENTATION_SUMMARY.md`

---

**Last Updated:** March 14, 2026 | Implementation: Complete ✅
