// ai.js — Gemini NLP integration via @google/genai + AI Studio API key

'use strict';

const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const { ElevenLabsClient } = require('elevenlabs');

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'project-b42dca89-e71d-4808-91b';
const LOCATION = process.env.GEMINI_LOCATION || 'global';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY || '' });

const SYSTEM_PROMPT = `You are a construction project data extractor for a Florida utility coordination platform.
Given a user's description of a construction project (text and/or audio), extract these fields:
- title: short project title
- county: one of the 67 Florida counties (normalize to Title Case, e.g. "Orange", "Volusia", "Leon")
- startTime: ISO 8601 date-time string in UTC. If only a date is given, use 08:00:00Z.
- endTime: ISO 8601 date-time string in UTC. If only a date is given, use 17:00:00Z.
- company: the construction company or contractor name (often the very first words of the sentence; e.g. "Browns.inc", "Harbor Utilities", "Orange County Public Works"). Preserve dots, lowercase, and abbreviations exactly.
- description: brief description of the work.

Return ONLY a JSON object with these exact keys, in this order if possible: title, company, county, startTime, endTime, description. No markdown fences, no explanation.
Example input: "browns.inc will be working on a sky factory from today to wednesday at miamidade"
Expected company from that: "browns.inc"
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

function heuristicCompany(text) {
  if (!text) return null;
  // Take everything before common action phrases; preserve dots/lowercase
  const m = text.match(/^(.+?)\s+(?:will be|will|is working|is creating|at\s+[A-Z][a-z]+\s+[A-Z][a-z]+|from\s+\w+)/i);
  if (!m) return null;
  const candidate = m[1].trim();
  // Ignore if it's clearly not a company (too short, just a preposition, etc.)
  if (candidate.length < 2) return null;
  return candidate;
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
      company: obj.company || null,
      description: obj.description || null,
    };
  } catch (e) {
    return { raw: text, error: 'Failed to parse Gemini JSON output' };
  }
}

async function transcribeAudio(audioBase64, mimeType = 'audio/webm') {
  // ponytail: file upload path; streaming STT upgrade if throughput matters
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
      console.error('ElevenLabs STT failed, falling back to raw audio to Gemini:', e.message || e);
      // fallback: pass raw audio to Gemini (existing behavior)
    }
  }
  if (!inputText && !audioBase64) throw new Error('No text or audio provided');

  const parts = [];
  if (inputText) parts.push({ text: inputText });
  // only send raw audio to Gemini if STT failed and we still have it
  if (audioBase64 && !inputText) {
    parts.push({ inlineData: { mimeType: mimeType || 'audio/webm', data: audioBase64 } });
  }
  if (parts.length === 0) throw new Error('No text or audio provided');

  const raw = await callGemini(parts, { systemPrompt: SYSTEM_PROMPT });
  const extracted = parseExtracted(raw);
  // ponytail: force company from leading text if Gemini misses it
  if (!extracted.company && inputText) {
    const heur = heuristicCompany(inputText);
    if (heur) extracted.company = heur;
  }
  return { ...extracted, company: extracted.company || null, transcript: inputText || null };
}

module.exports = { extractProjectFields, callGemini, parseExtracted };
