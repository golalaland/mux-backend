require('dotenv').config();
const express = require('express');
const Mux = require('@mux/mux-node');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Validate env vars
if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
  console.error("ERROR: Mux credentials are missing!");
  process.exit(1);
}

console.log("MUX_TOKEN_ID:", process.env.MUX_TOKEN_ID ? "LOADED" : "MISSING");
console.log("MUX_TOKEN_SECRET:", process.env.MUX_TOKEN_SECRET ? "LOADED" : "MISSING");

// Initialize Mux SDK (new style - no destructuring)
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// Helper: Get or create ONE permanent live stream
let permanentStream;
async function initPermanentStream() {
  let liveStreamId = process.env.MUX_LIVE_STREAM_ID;

  if (liveStreamId) {
    try {
      const existing = await mux.video.liveStreams.retrieve(liveStreamId);
      console.log(`Reusing existing stream (ID: ${liveStreamId}, status: ${existing.status})`);
      permanentStream = existing;
      return;
    } catch (err) {
      console.warn(`Stream ID ${liveStreamId} invalid/not found → creating new one`);
    }
  }

  // Create new (happens only once)
  console.log("Creating NEW permanent live stream...");
  const newStream = await mux.video.liveStreams.create({
    playback_policy: 'public',
    new_asset_settings: { playback_policy: ['public'] },
    latency_mode: 'low',
    reconnect_window: 60,
  });

  console.log("\n===== IMPORTANT - COPY THESE VALUES =====");
  console.log("Live Stream ID:", newStream.id);
  console.log("Playback ID:", newStream.playback_ids[0]?.id);
  console.log("Stream Key:", newStream.stream_key);
  console.log("RTMP URL:", newStream.rtmp?.url || 'rtmps://global-live.mux.com:443/app');
  console.log("=========================================\n");

  permanentStream = newStream;
}

// Run init on startup
initPermanentStream().catch(err => {
  console.error("Failed to init permanent stream:", err.message);
  // Don't crash the whole server – allow status endpoint to report issue
});

// Routes
app.get('/api/mux-live-status', async (req, res) => {
  const { type = 'regular' } = req.query;

  if (!permanentStream) {
    return res.status(503).json({ error: 'Stream still initializing... try again in 10-30 seconds' });
  }

  try {
    const latest = await mux.video.liveStreams.retrieve(permanentStream.id);
    res.json({
      isActive: latest.status === 'active',
      status: latest.status,
      playbackId: latest.playback_ids[0]?.id
    });
  } catch (err) {
    console.error("Status check error:", err.message);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// Debug info
app.get('/stream-info', (req, res) => {
  if (!permanentStream) return res.status(503).json({ error: 'Not ready yet' });
  res.json({
    liveStreamId: permanentStream.id,
    playbackId: permanentStream.playback_ids[0]?.id,
    status: permanentStream.status
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mux backend running on port ${PORT}`);
});
