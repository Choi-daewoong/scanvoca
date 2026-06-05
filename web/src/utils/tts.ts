// Chrome Web Speech API 주의사항:
// 1. 첫 speak()는 반드시 클릭 핸들러 동기 컨텍스트에서 호출해야 함 (user activation)
//    → setTimeout 안에서 호출하면 Chrome이 무시함 (이전 구현의 핵심 버그)
// 2. 현재 재생 중일 때 cancel() 후 즉시 speak()는 race condition 발생
//    → 재생 중일 때만 cancel+delay, 아닐 때는 즉시 호출
// 3. 탭 전환 등으로 synthesis가 paused 상태에 빠질 수 있음
//    → speak() 전 resume() 호출

export function speakWord(text: string): void {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;
  if (!text.trim()) return;

  const synth = window.speechSynthesis;

  // paused 상태 해제 (탭 전환 후 멈추는 버그 대응)
  synth.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 0.85;
  utterance.volume = 1.0;

  // 음성 선택 (없어도 lang='en-US'로 Chrome이 알아서 영어 음성 사용)
  const voices = synth.getVoices();
  const voice =
    voices.find(v => v.lang === 'en-US' && v.localService) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null;
  if (voice) utterance.voice = voice;

  if (synth.speaking || synth.pending) {
    // 재생 중: cancel 후 100ms 대기 (이미 이전 speak()로 user activation 완료됨)
    synth.cancel();
    setTimeout(() => synth.speak(utterance), 100);
  } else {
    // 재생 중 아님: 즉시 동기 호출 → user activation 유지 (첫 호출 필수)
    synth.speak(utterance);
  }
}
