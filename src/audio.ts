/** Spoken words (Web Speech API). Only offered when the browser/device supports it; no external service involved. */
export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export function speak(parts: { text: string; lang: "fr-FR" | "ar-SA" }[]) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  for (const p of parts) {
    const u = new SpeechSynthesisUtterance(p.text);
    u.lang = p.lang;
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}
