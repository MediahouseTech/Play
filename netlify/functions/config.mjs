import { getStore } from "@netlify/blobs";

const defaultConfig = {
  eventName: "Yabun Festival 2025",
  streamBaseUrl: "https://live-dashboard.bluehaze.studio/mux-stream/",
  expiryDate: "2026-01-27T23:59:00",
  producerPassword: "Live2Stream",
  eventInfo: {
    date: "Sunday 26 January 2025",
    callTime: "7:00 AM",
    liveStart: "10:00 AM",
    liveEnd: "6:00 PM",
    role: "Production Crew",
    brief: "Monitor your assigned stage. Report any audio/video issues to Scott immediately via WhatsApp.",
    whatsappLink: "https://chat.whatsapp.com/xxxxxxxxx",
    producerName: "Scott",
    producerPhone: "0412 XXX XXX"
  },
  streams: [
    { name: "Main Stage", playbackId: "", streamKey: "", rtmpUrl: "rtmp://global-live.mux.com:5222/app" },
    { name: "Yabun Yarns", playbackId: "", streamKey: "", rtmpUrl: "rtmp://global-live.mux.com:5222/app" },
    { name: "Corroboree", playbackId: "", streamKey: "", rtmpUrl: "rtmp://global-live.mux.com:5222/app" },
    { name: "Speak Out", playbackId: "", streamKey: "", rtmpUrl: "rtmp://global-live.mux.com:5222/app" }
  ],
  visibility: {
    vuMeters: true,
    streamStatus: true,
    duration: true,
    bitrate: false,
    viewers: false
  },
  defaultBandwidth: "medium"
};

export default async (req, context) => {
  const store = getStore("dashboard-config");

  // GET - Load config
  if (req.method === "GET") {
    try {
      const config = await store.get("config", { type: "json" });
      return new Response(JSON.stringify(config || defaultConfig), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error loading config:", error);
      return new Response(JSON.stringify(defaultConfig), {
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  // POST - Save config
  if (req.method === "POST") {
    try {
      const config = await req.json();
      await store.setJSON("config", config);
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("Error saving config:", error);
      return new Response(JSON.stringify({ error: "Failed to save" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/config"
};
