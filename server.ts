import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload limits for base64 photo uploads
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Lazy init Gemini client to avoid crashes if API key is missing
let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please add it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Endpoint for AI Retouch recommendations
app.post("/api/analyze-portrait", async (req, res) => {
  try {
    const { image } = req.body; // base64 image data-url

    if (!image) {
      return res.status(400).json({ error: "Missing image data in request body" });
    }

    // Parse base64
    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid data URL format" });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const ai = getAI();

    const prompt = `Analyze this portrait photo. You are an expert aesthetic consultant and photo retouching AI modeled after high-end beauty editors like Meitu.
Deliver a highly detailed, professional analysis of the portrait's lighting, skin texture, and key facial features, along with specific recommended values for retouching filters.

Return a JSON object conforming exactly to this structure:
{
  "analysis": "Provide a warm, supportive, and highly professional 2-3 sentence analysis of the subject's portrait (composition, expression, lighting, aesthetic strengths).",
  "recommendations": {
    "filmPreset": "Portra 400" | "Kodachrome 64" | "Superia 400" | "Cinestill 800T" | "Ilford HP5" | "Ektar 100",
    "presetReason": "A 1-sentence reason why this specific 35mm film filter fits the lighting, atmosphere, and mood of the photo.",
    "skinSmoothing": 30, // integer from 0 to 100, suggest a natural looking skin smoothing based on skin visible
    "skinToneWarmth": 10, // integer from -50 to 50 (negative for cool/blue, positive for warm/golden)
    "eyeBrightening": 15, // integer from 0 to 100
    "teethWhitening": 15, // integer from 0 to 100
    "makeup": {
      "lipstickColor": "#d86b6b", // hex color matching their skin tone/vibe (e.g., coral, soft pink, deep red)
      "lipstickOpacity": 20, // integer from 0 to 100
      "blushColor": "#f3a5a5", // hex color matching their cheeks (e.g. peach, baby pink, coral)
      "blushOpacity": 15, // integer from 0 to 100
      "eyeshadowColor": "#a48070", // hex color matching eyes/vibe (e.g. warm brown, nude bronze, champagne)
      "eyeshadowOpacity": 10 // integer from 0 to 100
    }
  }
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
        {
          text: prompt,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysis: { type: Type.STRING },
            recommendations: {
              type: Type.OBJECT,
              properties: {
                filmPreset: { type: Type.STRING },
                presetReason: { type: Type.STRING },
                skinSmoothing: { type: Type.INTEGER },
                skinToneWarmth: { type: Type.INTEGER },
                eyeBrightening: { type: Type.INTEGER },
                teethWhitening: { type: Type.INTEGER },
                makeup: {
                  type: Type.OBJECT,
                  properties: {
                    lipstickColor: { type: Type.STRING },
                    lipstickOpacity: { type: Type.INTEGER },
                    blushColor: { type: Type.STRING },
                    blushOpacity: { type: Type.INTEGER },
                    eyeshadowColor: { type: Type.STRING },
                    eyeshadowOpacity: { type: Type.INTEGER }
                  },
                  required: ["lipstickColor", "lipstickOpacity", "blushColor", "blushOpacity", "eyeshadowColor", "eyeshadowOpacity"]
                }
              },
              required: ["filmPreset", "presetReason", "skinSmoothing", "skinToneWarmth", "eyeBrightening", "teethWhitening", "makeup"]
            }
          },
          required: ["analysis", "recommendations"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("Failed to get content from Gemini response");
    }

    const result = JSON.parse(text.trim());
    return res.json(result);
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return res.status(500).json({
      error: "AI Portrait Analysis failed",
      message: error.message || "An error occurred during analysis"
    });
  }
});

// Setup Vite Dev server middleware or Production Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
