import { balls } from './balls.js';
import { FINISH_Y } from './track.js';

const rankingEl = document.getElementById('ranking-list');
let lastRenderTime = 0;

export function checkFinishLine(onFinish) {
  for (const ball of balls) {
    if (ball.finishPos === null && ball.body.position.y >= FINISH_Y) {
      const pos = balls.filter(b => b.finishPos !== null).length + 1;
      ball.finishPos = pos;
      onFinish(ball, pos);
    }
  }
}

export function getSortedRanking() {
  return [...balls].sort((a, b) => {
    if (a.finishPos !== null && b.finishPos !== null) return a.finishPos - b.finishPos;
    if (a.finishPos !== null) return -1;
    if (b.finishPos !== null) return 1;
    return b.body.position.y - a.body.position.y;
  });
}

export function renderRanking(now) {
  if (now - lastRenderTime < 80) return; // throttle ~12fps
  lastRenderTime = now;

  const sorted = getSortedRanking();
  const medals = ['🥇', '🥈', '🥉'];

  rankingEl.innerHTML = sorted.map((ball, i) => {
    const pos = i + 1;
    const medal = pos <= 3 ? medals[pos - 1] : '';
    const posClass = pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : '';
    const finished = ball.finishPos !== null ? 'finished' : '';
    const badge = ball.finishPos !== null ? `<span class="rank-badge">✓</span>` : '';
    return `<div class="rank-item ${finished}">
      <span class="rank-pos ${posClass}">${medal || pos}</span>
      <span class="rank-dot" style="background:${ball.color}"></span>
      <span class="rank-name">${ball.name}</span>
      ${badge}
    </div>`;
  }).join('');
}
