// ai.js — Gemini NLP integration via @google/genai + AI Studio API key

'use strict';

const { GoogleGenAI } = require('@google/genai');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'project-b42dca89-e71d-4808-91b';
const LOCATION = process.env.GEMINI_LOCATION || 'global';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_PROMPT = `You are a construction project data extractor for a Florida utility coordination platform.
Given a user's description of a construction project (text and/or audio), extract these fields:
- title: short project title
- county: one of the 67 Florida counties (normalize to Title Case, e.g. "Orange", "Volusia", "Leon")
- startTime: ISO 8601 date-time string in UTC. If only a date is given, use 08:00:00Z.
- endTime: ISO 8601 date-time string in UTC. If only a date is given, use 17:00:00Z.
- description: brief description of the work.

Return ONLY a JSON object with these keys. No markdown fences, no explanation.
If a field cannot be determined, set it to null.`;

async function callGemini(parts, options = {}) {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: { parts: [{ text: options.systemPrompt || SYSTEM_PROMPT }] },
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });
  return response.text || '';
}

function parseExtracted(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    const obj = JSON.parse(cleaned);
    return {
      title: obj.title || null,
      county: obj.county || null,
      startTime: obj.startTime || null,
      endTime: obj.endTime || null,
      description: obj.description || null,
    };
  } catch (e) {
    return { raw: text, error: 'Failed to parse Gemini JSON output' };
  }
}

async function extractProjectFields({ text, audioBase64, mimeType } = {}) {
  const parts = [];
  if (text) parts.push({ text });
  if (audioBase64) {
    parts.push({ inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } });
  }
  if (parts.length === 0) throw new Error('No text or audio provided');

  const raw = await callGemini(parts, { systemPrompt: SYSTEM_PROMPT });
  return parseExtracted(raw);
}

module.exports = { extractProjectFields, callGemini, parseExtracted };
