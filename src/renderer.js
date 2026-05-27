import { TRACK_W, TRACK_H, BALL_R, FINISH_Y } from './track.js';
import { balls } from './balls.js';
import { getEngine } from './physics.js';

const canvas = document.getElementById('race-canvas');
const ctx    = canvas.getContext('2d');
let cameraY      = 0;
let currentZoom  = 1.0;   // zoom dinâmico — recua quando o pelotão está junto
let trackScale   = 1.0;   // escala base: preenche a largura do canvas com o track
let rafId        = null;
let onFrame      = null;
let _raceStart   = null;
const RACE_LIMIT = 180000; // ms — espelho do timeout em main.js

// Trails do Top N — cada um se aposenta quando aquela posição cruza a linha.
// retired=true é PERMANENTE durante a corrida — nunca volta atrás.
// ballColor: cor da bolinha rastreada (string CSS) — atualizada dinamicamente.
// 5 slots pré-alocados; apenas os primeiros _winnerCount são usados.
const PODIUM_TRAILS = [
  { positions: [], lastId: -1, retired: false, ballColor: null, scale: 1.60, alpha: 0.80, blur: 22, maxLen: 38 }, // 1º — 100%
  { positions: [], lastId: -1, retired: false, ballColor: null, scale: 0.80, alpha: 0.40, blur: 11, maxLen: 19 }, // 2º —  50%
  { positions: [], lastId: -1, retired: false, ballColor: null, scale: 0.40, alpha: 0.20, blur:  6, maxLen: 10 }, // 3º —  25%
  { positions: [], lastId: -1, retired: false, ballColor: null, scale: 0.25, alpha: 0.13, blur:  4, maxLen:  7 }, // 4º
  { positions: [], lastId: -1, retired: false, ballColor: null, scale: 0.18, alpha: 0.09, blur:  3, maxLen:  5 }, // 5º
];

let _winnerCount  = 3;
let _broadcast    = false;   // Modo TV — reduz efeitos para transmissões (Teams/OBS)
let _lastRender   = 0;
const BCAST_FPS   = 30;
const BCAST_SCALE = 0.80;   // resolução do canvas em modo TV (80% → menos pixels p/ encodar)

export function setWinnerCount(n) {
  _winnerCount = Math.max(1, Math.min(5, n));
}

export function setBroadcastMode(on) {
  _broadcast = on;
  resizeCanvas();
  // Atualiza botão na UI
  const btn = document.getElementById('btn-broadcast');
  if (btn) btn.classList.toggle('active', on);
}

export function setRaceStartTime(t) { _raceStart = t; }
export function clearRaceTime()     { _raceStart = null; }

export function startRenderer(frameCallback) {
  onFrame = frameCallback;
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  loop(performance.now());
}

export function stopRenderer() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  window.removeEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const wrapper  = document.getElementById('canvas-wrapper');
  const pxRatio  = _broadcast ? BCAST_SCALE : 1.0;
  canvas.width   = Math.round(wrapper.clientWidth  * pxRatio);
  canvas.height  = Math.round(wrapper.clientHeight * pxRatio);
  // Mantém o tamanho visual — CSS estica de volta
  canvas.style.width  = wrapper.clientWidth  + 'px';
  canvas.style.height = wrapper.clientHeight + 'px';
  trackScale = (canvas.width / TRACK_W) * 0.5;
}

function loop(now) {
  rafId = requestAnimationFrame(loop);
  // Lógica de jogo roda sempre em full speed (física, ranking, failsafe)
  if (onFrame) onFrame(now);
  // Em modo TV: render travado em 30fps estável — frames consistentes ficam
  // melhores na compressão do Teams do que 55fps irregular
  if (_broadcast && now - _lastRender < 1000 / BCAST_FPS) return;
  _lastRender = now;
  render(now);
}

function render(now) {
  const W = canvas.width;
  const H = canvas.height;
  updateCamera(H);

  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#080814');
  bg.addColorStop(1, '#0d0d20');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  // trackScale preenche a largura; currentZoom é o zoom dinâmico do pelotão
  ctx.translate(W / 2, 0);
  ctx.scale(trackScale * currentZoom, trackScale * currentZoom);
  ctx.translate(-TRACK_W / 2, -cameraY);

  drawTrackBg();
  drawStaticBodies();
  drawFinishLine();
  drawBalls();

  ctx.restore();

  // HUD — desenhado em coordenadas de tela (fora do ctx.save/restore da câmera)
  drawTimeBar(now, W, H);
}

function updateCamera(H) {
  if (balls.length === 0) return;

  const active = balls.filter(b => b.finishPos === null);
  const pool   = active.length > 0 ? active : balls;

  // Ordena do mais avançado (maior Y) para o mais atrasado
  const sorted = [...pool].sort((a, b) => b.body.position.y - a.body.position.y);
  const leader = sorted[0];

  // Analisa spread das top-12 bolas para decidir zoom
  const topN     = sorted.slice(0, Math.min(12, sorted.length));
  const frontY   = topN[0].body.position.y;
  const backY    = topN[topN.length - 1].body.position.y;
  const spread   = frontY - backY;  // px entre 1ª e 12ª

  // Thresholds em track-pixels (dividir por trackScale converte screen→track)
  const TIGHT = H * 0.70 / trackScale;
  const LOOSE = H * 1.20 / trackScale;
  let targetZoom;
  if (spread < TIGHT) {
    // Pack junto — recua para mostrar o grupo todo
    targetZoom = Math.max(0.52, (TIGHT / Math.max(spread + 280, 350)));
    targetZoom = Math.min(0.90, targetZoom);
  } else if (spread > LOOSE) {
    // Pack esticado — zoom normal, segue o líder
    targetZoom = 1.0;
  } else {
    // Zona de transição suave
    const t = (spread - TIGHT) / (LOOSE - TIGHT);
    targetZoom = 0.90 + t * 0.10;
  }
  currentZoom += (targetZoom - currentZoom) * 0.035;

  // Altura visível do track em track-pixels
  const visH = H / (trackScale * currentZoom);

  // Câmera: segue pack center quando zoom-out, líder quando zoom normal
  let followY;
  if (currentZoom < 0.93) {
    const packCenterY = (frontY + backY) / 2;
    followY = packCenterY - visH * 0.45;
  } else {
    followY = leader.body.position.y - visH * 0.32;
  }

  cameraY += (followY - cameraY) * 0.07;
  cameraY = Math.max(0, Math.min(TRACK_H - visH, cameraY));
}

function drawTrackBg() {
  // Subtle lane stripes
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let x = 0; x < TRACK_W; x += 70) ctx.fillRect(x, 0, 35, TRACK_H);
  // Distance markers
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 14]);
  for (let y = 200; y < TRACK_H; y += 400) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TRACK_W, y); ctx.stroke();
  }
  ctx.setLineDash([]);
}

// Label → draw style
const BODY_STYLE = {
  wall:          { fill: '#12122a', stroke: null },
  container:     { fill: '#1e2a50', stroke: '#2a3a70' },
  gate:          { fill: '#334488', stroke: '#5566cc' },
  peg:           { fill: '#2244aa', stroke: '#4466dd', glow: '#3355ff' },
  ramp:          { fill: '#1a3366', stroke: '#2a4488' },
  bumper:        { fill: '#441166', stroke: '#8833cc', glow: '#aa44ff' },
  narrow:        { fill: '#0d3344', stroke: '#1a5566' },
  divider:       { fill: '#336633', stroke: '#55aa55', glow: '#44ff44' },
  paddle:        { fill: '#664400', stroke: '#ffaa00', glow: '#ffcc00' },
  'clock-hand':  { fill: '#553300', stroke: '#ffdd44', glow: '#ffee88' },
  'clock-pivot': { fill: '#ffffff', stroke: null },
  'final-funnel':{ fill: '#1a3322', stroke: '#2a5544' },
  channel:       { fill: '#0d3344', stroke: '#1a5566' },
  loop:          { fill: '#0a1a2e', stroke: '#2255bb', glow: '#1144cc' },
  boost:         { fill: '#0a2a18', stroke: '#00cc66', glow: '#00ff88' },
  floor:         { fill: '#0a0a1a', stroke: null },
};

function drawStaticBodies() {
  const engine = getEngine();
  if (!engine) return;
  const bodies = Matter.Composite.allBodies(engine.world);

  for (const body of bodies) {
    if (!body.isStatic) continue;
    const style = BODY_STYLE[body.label] || { fill: '#223366', stroke: '#334488' };
    const verts = body.vertices;

    ctx.save();

    if (style.glow && !_broadcast) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur  = 10;
    }

    // Draw body shape
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();

    ctx.fillStyle = style.fill;
    ctx.fill();

    if (style.stroke) {
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 0;
      ctx.stroke();
    }

    if (body.label === 'boost') {
      ctx.shadowBlur = 0;
      ctx.fillStyle  = '#00ff88';
      ctx.font       = 'bold 13px sans-serif';
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▼ ▼ ▼', body.position.x, body.position.y);
    }

    ctx.restore();
  }
}

function drawFinishLine() {
  const stripeW = 20;
  const count   = Math.ceil(TRACK_W / stripeW);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
    ctx.fillRect(i * stripeW, FINISH_Y - 8, stripeW, 16);
  }
  ctx.fillStyle = 'rgba(255,255,100,0.12)';
  ctx.fillRect(0, FINISH_Y - 3, TRACK_W, 6);
}

// Chamado por main.js via onBallFinish — aposenta o trail que estava rastreando
// esta bolinha específica (independente de qual posição ela chegou).
export function retireTrail(ball) {
  for (const trail of PODIUM_TRAILS.slice(0, _winnerCount)) {
    if (trail.lastId === ball.index && !trail.retired) {
      trail.retired = true;
      trail.positions.length = 0;
      trail.lastId = -1;
      return;
    }
  }
}

function drawBalls() {
  // Não computa retired aqui — é definido pelo evento retireTrail() chamado de main.js.

  // ── Slots ativos = os primeiros _winnerCount que ainda não foram aposentados ─
  // O 1º slot ativo recebe a bolinha líder, o 2º recebe a 2ª, etc.
  const activeSlots = PODIUM_TRAILS.slice(0, _winnerCount).filter(t => !t.retired);

  const active = balls.filter(b => b.finishPos === null);
  const sorted = [...active].sort((a, b) => b.body.position.y - a.body.position.y);
  const topN   = sorted.slice(0, activeSlots.length); // mesma quantidade de slots

  // ── Atualiza posições dos trails ativos ────────────────────────────────────
  for (let pos = 0; pos < topN.length; pos++) {
    const trail = activeSlots[pos];
    const ball  = topN[pos];
    if (ball.index !== trail.lastId) {
      trail.positions.length = 0; // bolinha mudou (overtake) → limpa rastro
      trail.lastId   = ball.index;
      trail.ballColor = ball.color; // cor da nova bolinha
    }
    trail.ballColor = ball.color; // atualiza sempre (mesma bolinha)
    trail.positions.push({ x: ball.body.position.x, y: ball.body.position.y });
    if (trail.positions.length > trail.maxLen) trail.positions.shift();
  }

  // ── Desenha trails ativos (atrás de todas as bolas) ────────────────────────
  for (const trail of activeSlots) {
    if (trail.positions.length < 3 || !trail.ballColor) continue;
    // Modo TV: rastro mais curto e sem blur para reduzir carga de renderização
    const drawLen = _broadcast
      ? Math.max(3, Math.ceil(trail.maxLen * 0.30))
      : trail.positions.length;
    const startIdx = trail.positions.length - Math.min(drawLen, trail.positions.length);
    const span     = trail.positions.length - startIdx - 1 || 1;
    for (let i = startIdx; i < trail.positions.length; i++) {
      const p   = (i - startIdx) / span;
      const rad = BALL_R * (0.20 + p * 0.58) * trail.scale;
      ctx.save();
      ctx.globalAlpha = p * trail.alpha;
      if (!_broadcast) {
        ctx.shadowColor = trail.ballColor;
        ctx.shadowBlur  = p * trail.blur;
      }
      ctx.beginPath();
      ctx.arc(trail.positions[i].x, trail.positions[i].y, rad, 0, Math.PI * 2);
      ctx.fillStyle = trail.ballColor;
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Mapa: índice da bola → trail (para anel pulsante e coroa) ──────────────
  const podiumMap = new Map(topN.map((b, pos) => [b.index, activeSlots[pos]]));

  // Desenha as bolas
  for (const ball of balls) {
    const trail = podiumMap.get(ball.index) ?? null; // objeto trail ou null
    const { x, y }  = ball.body.position;
    ctx.save();
    ctx.translate(x, y);

    // Anel pulsante para top-N — desativado no modo TV (caro de renderizar)
    if (!_broadcast && trail && trail.ballColor) {
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 180);
      ctx.beginPath();
      ctx.arc(0, 0, BALL_R + 5 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = trail.ballColor;
      ctx.globalAlpha = 0.55 + 0.45 * pulse;
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = trail.ballColor;
      ctx.shadowBlur  = 16;
      ctx.stroke();
      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;
    }

    // Shadow — omitido no modo TV
    if (!_broadcast) {
      ctx.beginPath();
      ctx.arc(2, 3, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
    }

    // Ball — gradiente normal ou cor sólida no modo TV
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    if (_broadcast) {
      ctx.fillStyle = ball.color;
    } else {
      const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, BALL_R);
      grad.addColorStop(0, lighten(ball.color, 32));
      grad.addColorStop(1, ball.color);
      ctx.fillStyle = grad;
    }
    ctx.fill();

    // Finished ring
    if (ball.finishPos !== null) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }

    // Initial
    ctx.fillStyle    = 'rgba(255,255,255,0.9)';
    ctx.font         = `bold ${BALL_R * 0.72}px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.initial, 0, 0.5);

    // Badge (pílula) + nome para top-N
    if (trail) {
      const isFirst   = trail === PODIUM_TRAILS[0];
      const firstName = ball.name.split(' ')[0];
      const fontSize  = BALL_R * 0.92;

      ctx.textAlign = 'center';

      // Mede largura do texto para dimensionar a pílula
      ctx.font = `600 ${fontSize}px sans-serif`;
      const tw   = ctx.measureText(firstName).width;
      const padX = BALL_R * 0.65;
      const padY = BALL_R * 0.28;
      const pw   = tw + padX * 2;          // largura da pílula
      const ph   = fontSize + padY * 2;    // altura da pílula
      const r    = ph / 2;                 // raio → cápsula totalmente arredondada
      const pillTop = -(BALL_R + 5 + ph);  // topo da pílula acima da bolinha

      // Coroa para 1º lugar — acima da pílula
      if (isFirst) {
        ctx.font         = `${BALL_R * 1.3}px serif`;
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha  = 1;
        if (!_broadcast) { ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4; }
        ctx.fillStyle    = '#FFD700';
        ctx.fillText('👑', 0, pillTop - 3);
        ctx.shadowBlur   = 0;
      }

      // Fundo escuro da pílula (cápsula)
      ctx.beginPath();
      ctx.moveTo(-pw / 2 + r, pillTop);
      ctx.arcTo( pw / 2, pillTop,      pw / 2, pillTop + ph, r);
      ctx.arcTo( pw / 2, pillTop + ph, -pw / 2, pillTop + ph, r);
      ctx.arcTo(-pw / 2, pillTop + ph, -pw / 2, pillTop,      r);
      ctx.arcTo(-pw / 2, pillTop,       pw / 2, pillTop,      r);
      ctx.closePath();

      ctx.globalAlpha = isFirst ? 0.90 : 0.80;
      ctx.fillStyle   = 'rgba(4, 4, 16, 0.88)';
      ctx.fill();

      // Borda na cor da própria bolinha
      ctx.globalAlpha  = isFirst ? 0.90 : 0.68;
      ctx.strokeStyle  = ball.color;
      ctx.lineWidth    = 1.6;
      ctx.stroke();

      // Texto branco centralizado na pílula
      ctx.globalAlpha  = 1;
      ctx.fillStyle    = '#ffffff';
      ctx.font         = `600 ${fontSize}px sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.shadowColor  = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur   = 3;
      ctx.fillText(firstName, 0, pillTop + ph / 2);
      ctx.shadowBlur   = 0;
    }

    ctx.restore();
  }
}

function lighten(hsl, amount) {
  return hsl.replace(/(\d+)%\)$/, (_, l) => `${Math.min(100, +l + amount)}%)`);
}

// ── Barra de progresso da corrida (baseada em posição da líder na pista) ────
// 0% = gate (y≈560) | 100% = linha de chegada (FINISH_Y)
const GATE_Y = 560;

function drawTimeBar(now, W, H) {
  if (_raceStart === null) return;
  const TRACK_LEN = FINISH_Y - GATE_Y; // dinâmico — depende do tamanho da corrida

  // Progresso = posição da bolinha mais avançada na pista
  let maxY = GATE_Y;
  for (const ball of balls) {
    const y = ball.finishPos !== null ? FINISH_Y : ball.body.position.y;
    if (y > maxY) maxY = y;
  }
  const progress  = Math.min(Math.max((maxY - GATE_Y) / TRACK_LEN, 0), 1);
  const elapsed   = Math.floor((now - _raceStart) / 1000);

  const barH  = H * 0.72;
  const barW  = 12;
  const x     = W - 30;
  const yTop  = H * 0.13;

  ctx.save();

  // Trilho de fundo
  ctx.beginPath();
  ctx.roundRect(x, yTop, barW, barH, 5);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  // Preenchimento — cresce de CIMA para BAIXO (igual às bolinhas caindo)
  const fillH = barH * progress;
  if (fillH > 0) {
    const grad = ctx.createLinearGradient(0, yTop, 0, yTop + barH);
    grad.addColorStop(0,   '#00ff88');   // topo = largada = verde
    grad.addColorStop(0.5, '#ffdd00');
    grad.addColorStop(1,   '#ff3333');   // base = chegada = vermelho
    ctx.beginPath();
    ctx.roundRect(x, yTop, barW, fillH, 5);
    ctx.fillStyle = grad;
    ctx.fill();

    // Brilho na ponta (marcador da líder) — fica na borda inferior do preenchimento
    const tipColor = progress > 0.8 ? '#ff3333' : progress > 0.5 ? '#ffdd00' : '#00ff88';
    ctx.beginPath();
    ctx.arc(x + barW / 2, yTop + fillH, barW / 2 + 2, 0, Math.PI * 2);
    ctx.fillStyle   = tipColor;
    ctx.shadowColor = tipColor;
    ctx.shadowBlur  = 12;
    ctx.fill();
    ctx.shadowBlur  = 0;
  }

  // Label topo — ícone de largada
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font      = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🚦', x + barW / 2, yTop - 7);

  // Label base — bandeira de chegada
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('🏁', x + barW / 2, yTop + barH + 14);

  // Percentual junto à ponta (só quando > 5%)
  if (progress > 0.05) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font      = 'bold 9px sans-serif';
    ctx.fillText(Math.round(progress * 100) + '%', x + barW / 2, yTop + fillH + 16);
  }

  // Tempo decorrido — abaixo da bandeira
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.font      = 'bold 10px sans-serif';
  ctx.fillText(elapsed + 's', x + barW / 2, yTop + barH + 28);

  ctx.restore();
}

export function getCameraY()  { return cameraY; }
export function resetCamera() {
  cameraY = 0;
  currentZoom = 1.0;
  for (const t of PODIUM_TRAILS) { t.positions.length = 0; t.lastId = -1; t.retired = false; t.ballColor = null; }
}
