// Shared Architech Wizard voice — British male, consistent across all pages
let wizardVoice = null;
let voicesReady = false;
let pendingSpeech = null;

function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  const britishVoices = voices.filter(v => /en[-_]?gb/i.test(v.lang) || /great britain|united kingdom/i.test(v.name));
  const britishMale = britishVoices.filter(v => /daniel|thomas|arthur|george|oliver|james|william|harry/i.test(v.name.toLowerCase()));
  if (britishMale.length) {
    // Prefer deeper male names
    const preferredNames = ['daniel', 'thomas', 'arthur', 'george', 'oliver', 'james'];
    for (const name of preferredNames) {
      const match = britishMale.find(v => v.name.toLowerCase().includes(name));
      if (match) {
        wizardVoice = match;
        break;
      }
    }
    if (!wizardVoice) wizardVoice = britishMale[0];
  } else if (britishVoices.length) {
    wizardVoice = britishVoices[0];
  } else {
    // Fallback: any male-sounding voice
    const maleLike = voices.filter(v => /male/i.test(v.name) || /daniel|thomas|arthur|george/i.test(v.name.toLowerCase()));
    wizardVoice = maleLike[0] || voices[0] || null;
  }
  voicesReady = true;
}

if (window.speechSynthesis) {
  window.speechSynthesis.getVoices(); // trigger load
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  // Retry quickly
  setTimeout(loadVoices, 100);
  setTimeout(loadVoices, 500);
  setTimeout(loadVoices, 1200);
}

function speakWizard(text) {
  if (!window.speechSynthesis) return;
  pendingSpeech = text || 'I am the Architech Wizard.';
  window.speechSynthesis.cancel();
  // Ensure voice loaded; retry once if needed
  if (!voicesReady || !wizardVoice) {
    loadVoices();
    // Small delay then retry
    setTimeout(() => speakWizard(pendingSpeech), 300);
    return;
  }
  const u = new SpeechSynthesisUtterance(pendingSpeech);
  // British male wizard settings: slower, slightly deep pitch
  u.lang = 'en-GB';
  u.rate = 0.78;
  u.pitch = 0.72;
  u.volume = 1;
  if (wizardVoice) u.voice = wizardVoice;
  u.onstart = () => { pendingSpeech = null; };
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(u);
}

// Some browsers suppress speech started from page load until the user interacts.
function retryPendingSpeech() {
  if (pendingSpeech) speakWizard(pendingSpeech);
}

document.addEventListener('pointerdown', retryPendingSpeech, { once: true });
document.addEventListener('keydown', retryPendingSpeech, { once: true });
