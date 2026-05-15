export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

export function runCountdown(onDone) {
  const overlay = document.getElementById('countdown-overlay');
  const text    = document.getElementById('countdown-text');
  const steps   = ['3', '2', '1', 'GO!'];
  let i = 0;

  overlay.classList.remove('hidden');

  function tick() {
    text.textContent = steps[i];
    text.style.animation = 'none';
    void text.offsetWidth; // reflow to restart animation
    text.style.animation = '';

    i++;
    if (i < steps.length) {
      setTimeout(tick, i < steps.length - 1 ? 900 : 600);
    } else {
      setTimeout(() => {
        overlay.classList.add('hidden');
        onDone();
      }, 600);
    }
  }
  tick();
}

export function showPodium(topBalls, onRestart) {
  showScreen('screen-podium');

  const container = document.getElementById('podium-places');
  const n = topBalls.length;

  // Medals by actual finish position (index in topBalls)
  const medals = ['🥇 1º', '🥈 2º', '🥉 3º', '4º', '5º'];

  // Visual display order: 2nd on left, 1st in center, then 3rd, 4th, 5th to the right
  // n=1: [0]   n=2: [1,0]   n≥3: [1,0,2,3,4]
  let visualOrder;
  if (n === 1) {
    visualOrder = [0];
  } else if (n === 2) {
    visualOrder = [1, 0];
  } else {
    visualOrder = [1, 0, 2, 3, 4].slice(0, n);
  }

  // CSS place class by actual finish position
  const placeClass = ['place-1', 'place-2', 'place-3', 'place-4', 'place-5'];

  container.innerHTML = visualOrder.map(posIdx => {
    const ball = topBalls[posIdx];
    if (!ball) return '';
    return `
      <div class="podium-place ${placeClass[posIdx]}">
        <div class="podium-ball" style="background:${ball.color}">${ball.initial}</div>
        <div class="podium-name">${ball.name}</div>
        <div class="podium-block">${medals[posIdx]}</div>
      </div>
    `;
  }).join('');

  document.getElementById('btn-restart').onclick = onRestart;
}
