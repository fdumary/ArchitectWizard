// ai.js — Pure Gemini NLP integration via Vertex AI

'use strict';

const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const { ElevenLabsClient } = require('elevenlabs');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'project-b42dca89-e71d-4808-91b';
const LOCATION = process.env.GEMINI_LOCATION || 'us-central1';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY || '' });

const SYSTEM_PROMPT = `You are an expert NLP extraction engine for a Florida utility and construction coordination platform complying with FERC Order 1920.

Your job is to read or listen to project descriptions and extract the core planning parameters into structured data.

Current context:
- State: Florida
- Current Date baseline: September 2026

Extraction Guidelines:
- title: Short, concise summary of the work (e.g., "Updating the pipe", "Creating a jar", "Substation repair").
- company: The organization, utility, contractor, or entity doing the work. Extract this regardless of where or how it appears in the sentence (e.g., "Apple is working...", "my company is named Apple", "FPL", "Browns.inc").
- county: The Florida county name in Title Case (normalize variations like "miami dade" -> "Miami-Dade").
- startTime: ISO 8601 UTC timestamp. If only a date or weekday is given, assume 08:00:00Z.
- endTime: ISO 8601 UTC timestamp. If only a date or weekday is given, assume 17:00:00Z.
- description: A brief summary of the intended work.

If any field is truly not mentioned, return null for that field.`;

const projectSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short title of the project' },
    company: { type: Type.STRING, description: 'The utility, contractor, or company name, or the people doing the work' },
    county: { type: Type.STRING, description: 'Florida county in Title Case' },
    startTime: { type: Type.STRING, description: 'ISO 8601 UTC start timestamp' },
    endTime: { type: Type.STRING, description: 'ISO 8601 UTC end timestamp' },
    description: { type: Type.STRING, description: 'Brief description of the work' },
  },
};

async function callGemini(parts) {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      responseMimeType: 'application/json',
      responseSchema: projectSchema,
      temperature: 0.1,
    },
  });
  return response.text || '{}';
}

function parseExtracted(text) {
  try {
    const cleaned = text.replace(/```(?:json)?/gi, '').trim();
    const obj = JSON.parse(cleaned);
    return {
      title: obj.title || null,
      county: obj.county || null,
      startTime: obj.startTime || null,
      endTime: obj.endTime || null,
      company: obj.company || null,
      description: obj.description || null,
    };
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', text, err);
    return { title: null, county: null, startTime: null, endTime: null, company: null, description: null };
  }
}

async function transcribeAudio(audioBase64, mimeType = 'audio/webm') {
  const ext = (mimeType || 'audio/webm').split('/')[1] || 'webm';
  const tmpName = path.join(require('os').tmpdir(), `record-${Date.now()}.${ext}`);
  fs.writeFileSync(tmpName, Buffer.from(audioBase64, 'base64'));

  const response = await elevenlabs.speechToText.convert({
    file: fs.createReadStream(tmpName),
    model_id: 'scribe_v1',
    language_code: 'en',
  });

  fs.unlinkSync(tmpName);
  return response.text || '';
}

async function extractProjectFields({ text, audioBase64, mimeType } = {}) {
  let inputText = text;

  if (audioBase64) {
    try {
      inputText = await transcribeAudio(audioBase64, mimeType);
    } catch (e) {
      console.error('ElevenLabs STT error, forwarding raw audio directly to Gemini:', e.message || e);
    }
  }

  if (!inputText && !audioBase64) throw new Error('No text or audio provided');

  const parts = [];
  if (inputText) {
    parts.push({ text: inputText });
  } else if (audioBase64) {
    parts.push({ inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } });
  }

  const rawJson = await callGemini(parts);
  const extracted = parseExtracted(rawJson);

  const result = { ...extracted, transcript: inputText || null };
  // Simple fallback: first token before action verb if Gemini misses company
  if (!result.company && inputText) {
    const m = inputText.match(/^([A-Za-z0-9.]+)(?:\s+(?:is|will|at|from)|\b)/i);
    if (m) result.company = m[1].trim();
  }
  return result;
}

module.exports = { extractProjectFields, callGemini, parseExtracted };