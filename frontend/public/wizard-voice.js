// Shared Architech Wizard voice — consistent across all pages
function speakWizard(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text || 'I am the Architech Wizard.');
  // Wizard-like settings: slow, slightly high pitch
  u.rate = 0.82;
  u.pitch = 1.25;
  u.volume = 1;
  try {
    const voices = window.speechSynthesis.getVoices();
    // Prefer wizard-like voices; fall back to first available
    const preferred = voices.find(v =>
      /google/i.test(v.name) || /samantha/i.test(v.name) || /karen/i.test(v.name) || /daniel/i.test(v.name)
    );
    if (preferred) u.voice = preferred;
  } catch (e) {}
  window.speechSynthesis.speak(u);
}
