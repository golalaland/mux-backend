require('dotenv').config();
const express = require('express');
const Mux = require('@mux/mux-node');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Correct way for latest SDK (v8+)
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// Create live stream endpoint
app.post('/create-live-stream', async (req, res) => {
  try {
    const liveStream = await mux.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: { playback_policy: ['public'] },
      latency_mode: 'low', // or 'standard' or 'reduced'
      reconnect_window: 60,
    });

    const playbackId = liveStream.playback_ids[0].id;

    res.json({ playbackId });
  } catch (error) {
    console.error('Mux error:', error);
    res.status(500).json({ error: 'Failed to create stream', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mux backend server running on http://localhost:${PORT}`);
});