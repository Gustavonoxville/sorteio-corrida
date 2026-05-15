const { Bodies, Body, Composite } = Matter;

export const TRACK_W  = 700;
export const TRACK_H  = 25000;
export const BALL_R   = 13;
export const FINISH_Y = TRACK_H - 200;

const WALL_T  = 80   // paredes grossas — evita tunelamento com 100 bolinhas;
const MIN_GAP = BALL_R * 4;

// Estado do handicap — atualizado por main.js a cada frame
// lastFiredAt: performance.now() do último disparo (ms)
// ACTIVE_MS:   quanto tempo o caret fica apontado pro líder após o disparo
// COOLDOWN_MS: tempo mínimo entre disparos
export const handicapState = {
  leaderX:     TRACK_W / 2,
  gap:         0,
  lastFiredAt: -99999,
  ACTIVE_MS:   1200,   // 1.2s apontando pro líder
  COOLDOWN_MS: 9000,   // 9s de cooldown entre intervenções
};

export function buildTrack(world) {
  const all      = [];
  const animated = [];

  // ── Outer walls ───────────────────────────────────────────────────────
  // Walls span from y=-600 to y=TRACK_H to prevent balls spawning above y=0
  // from escaping laterally before they fall into the container.
  const WALL_TOP    = -600;
  const WALL_HEIGHT = TRACK_H - WALL_TOP;          // 25600
  const WALL_CY     = WALL_TOP + WALL_HEIGHT / 2;  // 12200
  const wallOpts = { isStatic: true, friction: 0.3, restitution: 0.4, label: 'wall' };
  all.push(
    Bodies.rectangle(-WALL_T / 2,          WALL_CY, WALL_T, WALL_HEIGHT, wallOpts),
    Bodies.rectangle(TRACK_W + WALL_T / 2, WALL_CY, WALL_T, WALL_HEIGHT, wallOpts),
  );
  // Ceiling — catches any extreme upward bounce above the container
  all.push(Bodies.rectangle(TRACK_W / 2, WALL_TOP, TRACK_W + WALL_T * 4, 30, {
    isStatic: true, friction: 0, restitution: 0.15, label: 'container',
  }));

  // ── Container + gate ──────────────────────────────────────────────────
  const cOpts = { isStatic: true, friction: 0.2, restitution: 0.4, label: 'container' };
  all.push(
    tilt(130, 280, 320, 18,  0.5, cOpts),   // rampas maiores → boca mais larga
    tilt(570, 280, 320, 18, -0.5, cOpts),
  );
  // Paredes verticais laterais — impedem bolinhas de escapar pelo topo das rampas
  const sideOpts = { isStatic: true, friction: 0.3, restitution: 0.1, label: 'container' };
  all.push(Bodies.rectangle(18,           200, 18, 440, sideOpts));  // parede esq
  all.push(Bodies.rectangle(TRACK_W - 18, 200, 18, 440, sideOpts));  // parede dir
  // Gate extra-largo e espesso — garante que nenhuma bolinha escape antes do GO!
  const gate = Bodies.rectangle(TRACK_W / 2, 590, TRACK_W + WALL_T * 4, 36, {
    isStatic: true, friction: 0, restitution: 0.05, label: 'gate',
  });
  all.push(gate);
  // Tampas laterais — selam os cantos entre gate e paredes
  const capOpts = { isStatic: true, friction: 0, restitution: 0.05, label: 'gate' };
  all.push(Bodies.rectangle(-WALL_T,         583, WALL_T * 2, 50, capOpts));  // canto esq
  all.push(Bodies.rectangle(TRACK_W + WALL_T, 583, WALL_T * 2, 50, capOpts));  // canto dir

  // ^ INICIAL — dois braços fixos, SEM animação, apenas separa as bolinhas
  {
    const _cx = TRACK_W / 2, _cy = 700, _ang = 0.52, _hw = 80 * Math.cos(_ang), _hv = 80 * Math.sin(_ang);
    const _o  = { isStatic: true, friction: 0.06, restitution: 0.62, label: 'ramp' };
    const _l  = Bodies.rectangle(_cx - _hw, _cy + _hv, 160, 14, _o);
    const _r  = Bodies.rectangle(_cx + _hw, _cy + _hv, 160, 14, _o);
    Body.setAngle(_l, -_ang);
    Body.setAngle(_r,  _ang);
    all.push(_l, _r);
    // NÃO adiciona a animated — fica completamente parado
  }

  // ══════════════════════════════════════════════════════════════════════
  //  TRACK ZONES — 25 000px | espaçamento mínimo ~380px entre zonas
  //  ^  = Caret    (V invertido, desloca lateralmente)
  //  V  = V-Clock  (dois braços girantes, prende bolinhas)
  //  BT = Boost    (setinhas ▼ que aceleram a bolinha)
  // ══════════════════════════════════════════════════════════════════════

  // Z1 — abertura suave (poucos pegs, pequenos — não filtrar muito no inicio)
  all.push(...pegs(820, 2, 4, 110, 10, 14));                   // ends ~940

  // Z2 — rampas + pegs suaves (início aberto, bolas ficam juntas)
  all.push(...ramps(1250, 3, 220, 0.32));                      // ends ~1910
  all.push(...pegs(2000, 2, 4, 110, 10, 10));                  // sparse pegs

  // PADDLES A
  addPaddles(all, animated, 2450, 3, 155, 1.0, 2.1);          // ends ~3140

  // ^ A
  addCaret(all, animated, TRACK_W / 2, 3200, 170, 155, 1.2);

  // bumpers A
  all.push(...bumpers(3530, 3, 24));                           // ends ~3730

  // Z3 — pegs
  all.push(...pegs(4050, 4, 6, 70, 12, 10));                  // ends ~4260

  // ^ B
  addCaret(all, animated, TRACK_W / 2, 4560, 175, 165, 0.9);

  // V-CLOCK A
  addVClock(all, animated, TRACK_W / 2, 4900, 210, 1.0);

  // NARROW A
  all.push(...narrowRamps(5280, 330));                         // ends ~5430 — mais largo no início

  // ^ C
  addCaret(all, animated, TRACK_W / 2, 5680, 165, 150, 1.3);

  // PADDLES B
  addPaddles(all, animated, 6000, 3, 150, 0.9, 2.0);          // ends ~6690

  // CLOCK A — grande
  addClock(all, animated, TRACK_W / 2, 7050, 290, 1.15);

  // Z4 — pegs
  all.push(...pegs(7480, 4, 6, 70, 12, 9));                   // ends ~7690

  // ^ D
  addCaret(all, animated, TRACK_W / 2, 7980, 180, 160, 1.0);

  // BIFURCAÇÃO
  split(all, animated, 8350, 1500);                           // ends ~9850

  // V-CLOCK B
  addVClock(all, animated, TRACK_W / 2, 10050, 220, -1.0);

  // bumpers B
  all.push(...bumpers(10400, 3, 23));                          // ends ~10600

  // ^ E
  addCaret(all, animated, TRACK_W / 2, 10900, 172, 162, 1.2);

  // PADDLES C
  addPaddles(all, animated, 11220, 3, 150, 0.85, 1.8);        // ends ~11910

  // ── X — ROTATIVOS (substituem o loop) ───────────────────────────────
  addRotatingX(all, animated, TRACK_W * 0.28, 12250, 1.50,  0.0);
  addRotatingX(all, animated, TRACK_W * 0.72, 12500, -1.30, 1.5);
  // X terceiro — movido para depois do BOOST A, sem conflito com paddles

  // NARROW B
  all.push(...narrowRamps(12900, 260));                        // ends ~13060

  // CLOCK B
  addClock(all, animated, TRACK_W / 2, 13380, 275, -1.4);

  // ^ J — preenche o gap antes do village (era vazio ~965px)
  addCaret(all, animated, TRACK_W / 2, 13850, 165, 145, 1.0);

  // bumpers E — aquece antes do village
  all.push(...bumpers(14180, 2, 20));                          // ends ~14380

  // Z4b — pegs antes do village
  all.push(...pegs(14420, 2, 5, 80, 10, 8));                  // ends ~14500

  // ══════════════════════════════════════════════════════════════════════
  //  ALPHABET VILLAGE — letras Z X Y T M girando continuamente
  //  s=55 → raio máx ≈ 62px; espaçamento ≈ 224px → sem sobreposição
  //  speed 2.2–3.2 rad/s (≈ 2–3× mais rápido que os relógios)
  // ══════════════════════════════════════════════════════════════════════
  const _S = 55;
  // Fileira 1
  _addRotatingLetter(all, animated, TRACK_W * 0.18, 14680, _letterZ(_S), 2.4,  0.0);
  _addRotatingLetter(all, animated, TRACK_W * 0.50, 14680, _letterT(_S), 2.8,  1.2);
  _addRotatingLetter(all, animated, TRACK_W * 0.82, 14680, _letterX(_S), 2.2,  2.5);
  // Fileira 2 (intercalada)
  _addRotatingLetter(all, animated, TRACK_W * 0.33, 15000, _letterY(_S), 3.0,  0.8);
  _addRotatingLetter(all, animated, TRACK_W * 0.67, 15000, _letterM(_S), 2.6,  3.0);
  // Fileira 3
  _addRotatingLetter(all, animated, TRACK_W * 0.18, 15320, _letterX(_S), 2.9,  1.5);
  _addRotatingLetter(all, animated, TRACK_W * 0.50, 15320, _letterZ(_S), 2.3,  0.3);
  _addRotatingLetter(all, animated, TRACK_W * 0.82, 15320, _letterT(_S), 3.2,  2.0);

  // ^ F — após o village (y=15560, antes dos pegs em 15580 há espaço suficiente)
  addCaret(all, animated, TRACK_W / 2, 15560, 175, 155, 1.1);

  // Z5 — pegs
  all.push(...pegs(15720, 4, 6, 70, 12, 9));                  // ends ~16000

  // V-CLOCK C
  addVClock(all, animated, TRACK_W / 2, 16080, 225, 0.95);

  // bumpers C + central
  all.push(...bumpers(16480, 4, 22));                          // ends ~16780
  all.push(Bodies.circle(TRACK_W / 2, 16630, 28, { isStatic:true, friction:0.02, restitution:0.90, label:'bumper' }));

  // DIAGONAL A
  addDiagonalBars(all, animated, 16980, 2, 1.3);              // ends ~17260

  // ^ G — espaço adequado após diagonal
  addCaret(all, animated, TRACK_W / 2, 17550, 175, 160, 1.0);

  // PADDLES D
  addPaddles(all, animated, 17820, 3, 145, 1.1, 1.95);        // ends ~18510

  // ── X rotativo — entre paddles e estreitamento ───────────────────────
  addRotatingX(all, animated, TRACK_W / 2, 18600, 1.8, 0.8);

  // ── BT — BOOST A: pista livre antes (narrow removida — cobria o boost) ──
  addBoostGate(all, TRACK_W * 0.25, 18900);
  addBoostGate(all, TRACK_W * 0.75, 18900);
  addBoostGate(all, TRACK_W * 0.50, 19060);
  //                  ↑ pista livre até y=19900 ↑

  // CLOCK C
  addClock(all, animated, TRACK_W / 2, 19900, 285, 0.95);

  // Z6 — pegs
  all.push(...pegs(20380, 4, 6, 70, 12, 9));                  // ends ~20660

  // V-CLOCK D
  addVClock(all, animated, TRACK_W / 2, 20950, 215, -1.05);

  // ^ H — antes do sprint final (longe dos X's em y=22140)
  addCaret(all, animated, TRACK_W / 2, 20750, 170, 162, 1.2);

  // ALPHABET LATE — letras Y e M substituem copos rotativos
  _addRotatingLetter(all, animated, TRACK_W * 0.25, 21200, _letterY(_S), 2.8, 0.4);
  _addRotatingLetter(all, animated, TRACK_W * 0.75, 21200, _letterM(_S), 2.5, 2.1);

  // DIAGONAL B
  addDiagonalBars(all, animated, 21740, 2, 1.5);              // ends ~22020

  // ── X rotativos extras — sprint final ───────────────────────────────
  addRotatingX(all, animated, TRACK_W * 0.28, 22140, 2.0,  0.0);
  addRotatingX(all, animated, TRACK_W * 0.72, 22140, -2.0, 1.3);

  // bumpers D
  all.push(...bumpers(22380, 3, 23));                          // ends ~22580

  // PADDLES E
  all.push(...pegs(22600, 2, 5, 100, 11, 14));                // pegs soltos — menos denso que paddles
  addPaddles(all, animated, 22800, 2, 148, 1.15, 1.9);        // ends ~23030

  // ── BT — BOOST B: ~370px livres antes, ~500px livres depois ──────────
  addBoostGate(all, TRACK_W * 0.20, 23200);
  addBoostGate(all, TRACK_W * 0.80, 23200);
  addBoostGate(all, TRACK_W * 0.50, 23350);
  //                  ↑ pista livre até y=23850 (~500px de runway) ↑

  // ^ I — bem depois do boost, aproveita velocidade
  addCaret(all, animated, TRACK_W / 2, 23700, 178, 150, 0.9);

  // Z7 — pegs finais
  all.push(...pegs(23980, 2, 5, 80, 11, 10));                 // ends ~24060

  // CLOCK D — portão final
  addClock(all, animated, TRACK_W / 2, 24280, 240, -1.2);

  // Final funnel
  all.push(...finalFunnel(24550));

  // ── Wall guards — pegs every 160px along both walls (entire track) ───
  // Prevents balls from sliding along walls through empty zones unimpeded
  all.push(...wallGuards(620, FINISH_Y - 200, 160));

  // ── Floor ─────────────────────────────────────────────────────────────
  all.push(Bodies.rectangle(TRACK_W / 2, TRACK_H + WALL_T / 2, TRACK_W + WALL_T * 2, WALL_T, {
    isStatic: true, label: 'floor', friction: 0.5, restitution: 0.1,
  }));

  Composite.add(world, all);
  return { gate, animated };
}

export function openGate(world) {
  // Remove todos os corpos com label 'gate' (gate principal + tampas laterais)
  const bodies = Matter.Composite.allBodies(world);
  for (const b of bodies) {
    if (b.label === 'gate') Composite.remove(world, b);
  }
}

// ── Animated obstacle factories ──────────────────────────────────────────

function addClock(all, animated, cx, cy, armLen, speed) {
  // Tiny pivot (no collision — cosmetic)
  const pivot = Bodies.circle(cx, cy, 5, {
    isStatic: true, label: 'clock-pivot',
    collisionFilter: { mask: 0 },
  });
  all.push(pivot);

  const hand = Bodies.rectangle(cx + armLen / 2, cy, armLen, 16, {
    isStatic: true, friction: 0.04, restitution: 0.65, label: 'clock-hand',
  });
  all.push(hand);

  animated.push({
    body: hand,
    tick(t) {
      const a = t * speed;
      Body.setPosition(hand, { x: cx + Math.cos(a) * armLen / 2, y: cy + Math.sin(a) * armLen / 2 });
      Body.setAngle(hand, a);
    },
  });
}

function addStaticCaret(all, cx, cy, armLen) {
  const angle = 0.52;
  const hw    = armLen / 2 * Math.cos(angle);
  const hv    = armLen / 2 * Math.sin(angle);
  const opts  = { isStatic: true, friction: 0.06, restitution: 0.62, label: 'ramp' };
  const lArm  = Bodies.rectangle(cx - hw, cy + hv, armLen, 14, opts);
  const rArm  = Bodies.rectangle(cx + hw, cy + hv, armLen, 14, opts);
  Body.setAngle(lArm, -angle);
  Body.setAngle(rArm,  angle);
  all.push(lArm, rArm);
}

function addCaret(all, animated, cx, cy, armLen, travelX, speed) {
  const angle = 0.52;
  const hw    = armLen / 2 * Math.cos(angle);
  const hv    = armLen / 2 * Math.sin(angle);
  const opts  = { isStatic: true, friction: 0.06, restitution: 0.62, label: 'paddle' };

  const lArm = Bodies.rectangle(cx - hw, cy + hv, armLen, 14, opts);
  const rArm = Bodies.rectangle(cx + hw, cy + hv, armLen, 14, opts);
  Body.setAngle(lArm, -angle);
  Body.setAngle(rArm,  angle);
  all.push(lArm, rArm);

  // Calcula o offset horizontal compartilhado pelos dois braços,
  // incluindo handicap: quanto maior a vantagem do líder, mais rápido
  // e mais direcionado ao X dele o caret fica.
  function caretOffset(t) {
    const { leaderX, lastFiredAt, ACTIVE_MS } = handicapState;
    const elapsed = performance.now() - lastFiredAt;
    if (elapsed > ACTIVE_MS) {
      // Fora da janela ativa → oscilação completamente normal
      return Math.sin(t * speed) * travelX;
    }
    // Dentro da janela: interpola suavemente do normal para o bias e de volta
    // p vai de 0→1→0 formando um sino (entra, fica, sai)
    const p   = Math.sin((elapsed / ACTIVE_MS) * Math.PI); // 0..1..0
    const pull = Math.max(-travelX * 0.9, Math.min(travelX * 0.9, leaderX - cx));
    const normal = Math.sin(t * speed) * travelX;
    return normal * (1 - p * 0.15) + pull * p * 0.35;
  }

  animated.push({ body: lArm, tick(t) {
    const ox = caretOffset(t);
    Body.setPosition(lArm, { x: cx - hw + ox, y: cy + hv });
    Body.setAngle(lArm, -angle);
  }});
  animated.push({ body: rArm, tick(t) {
    const ox = caretOffset(t);
    Body.setPosition(rArm, { x: cx + hw + ox, y: cy + hv });
    Body.setAngle(rArm,  angle);
  }});
}

function addVClock(all, animated, cx, cy, armLen, speed) {
  const pivot = Bodies.circle(cx, cy, 5, {
    isStatic: true, label: 'clock-pivot', collisionFilter: { mask: 0 },
  });
  all.push(pivot);

  const spread = 0.55;
  const opts   = { isStatic: true, friction: 0.04, restitution: 0.65, label: 'clock-hand' };
  const lArm   = Bodies.rectangle(0, 0, armLen, 16, opts);
  const rArm   = Bodies.rectangle(0, 0, armLen, 16, opts);
  all.push(lArm, rArm);

  animated.push({
    body: lArm,
    tick(t) {
      const a = t * speed - spread;
      Body.setPosition(lArm, { x: cx + Math.cos(a) * armLen / 2, y: cy + Math.sin(a) * armLen / 2 });
      Body.setAngle(lArm, a);
    },
  });
  animated.push({
    body: rArm,
    tick(t) {
      const a = t * speed + spread;
      Body.setPosition(rArm, { x: cx + Math.cos(a) * armLen / 2, y: cy + Math.sin(a) * armLen / 2 });
      Body.setAngle(rArm, a);
    },
  });
}

function addDiagonalBars(all, animated, yStart, count, speed) {
  const barW   = 210;
  const travel = 120;
  const opts   = { isStatic: true, friction: 0.06, restitution: 0.55, label: 'paddle' };

  for (let i = 0; i < count; i++) {
    const y     = yStart + i * 280;
    const phase = i * 1.6;

    // \ bar — slides diagonally down-right ↔ up-left
    const cx1 = TRACK_W * 0.30;
    const b1  = Bodies.rectangle(cx1, y, barW, 14, opts);
    all.push(b1);
    animated.push({ body: b1, tick(t) {
      const p = Math.sin(t * speed + phase);
      Body.setPosition(b1, { x: cx1 + p * travel * 0.82, y: y + p * travel * 0.57 });
      Body.setAngle(b1, 0.60);
    }});

    // / bar — slides diagonally down-left ↔ up-right, offset 140px below
    const cx2 = TRACK_W * 0.70;
    const b2  = Bodies.rectangle(cx2, y + 140, barW, 14, opts);
    all.push(b2);
    animated.push({ body: b2, tick(t) {
      const p = Math.sin(t * speed + phase + Math.PI);
      Body.setPosition(b2, { x: cx2 - p * travel * 0.82, y: (y + 140) + p * travel * 0.57 });
      Body.setAngle(b2, -0.60);
    }});
  }
}

function addPaddles(all, animated, yStart, count, len, speedL, speedR) {
  const maxPush = 165;
  for (let i = 0; i < count; i++) {
    const y      = yStart + i * 230;
    const phaseL = i * 1.4;
    const phaseR = i * 1.4 + Math.PI;

    const lB = Bodies.rectangle(len / 2 + 4, y, len, 14, {
      isStatic: true, friction: 0.06, restitution: 0.58, label: 'paddle',
    });
    all.push(lB);
    animated.push({ body: lB, tick(t) {
      const push = ((Math.sin(t * speedL + phaseL) + 1) / 2) * maxPush;
      Body.setPosition(lB, { x: len / 2 + 4 + push, y: lB.position.y });
    }});

    const rB = Bodies.rectangle(TRACK_W - len / 2 - 4, y, len, 14, {
      isStatic: true, friction: 0.06, restitution: 0.58, label: 'paddle',
    });
    all.push(rB);
    animated.push({ body: rB, tick(t) {
      const push = ((Math.sin(t * speedR + phaseR) + 1) / 2) * maxPush;
      Body.setPosition(rB, { x: TRACK_W - len / 2 - 4 - push, y: rB.position.y });
    }});
  }
}

// ── Static zone builders ─────────────────────────────────────────────────

// pegs with optional random jitter for unpredictability
function pegs(yStart, rows, cols, rowGap, pegR, jitter = 0) {
  const opts  = { isStatic: true, friction: 0.04, restitution: 0.58, label: 'peg' };
  const xStep = (TRACK_W - 110) / (cols - 1);
  const parts = [];
  for (let r = 0; r < rows; r++) {
    const y      = yStart + r * rowGap + (Math.random() - 0.5) * jitter;
    const offset = r % 2 === 0 ? 0 : xStep / 2;
    for (let c = 0; c < cols; c++) {
      const x = 55 + offset + c * xStep + (Math.random() - 0.5) * jitter;
      if (x > MIN_GAP && x < TRACK_W - MIN_GAP)
        parts.push(Bodies.circle(x, y, pegR + Math.random() * 3, opts));
    }
  }
  return parts;
}

function ramps(yStart, count, rampW, baseAngle) {
  const opts  = { isStatic: true, friction: 0.22, restitution: 0.38, label: 'ramp' };
  const parts = [];
  for (let i = 0; i < count; i++) {
    const dir   = i % 2 === 0 ? 1 : -1;
    const cx    = i % 2 === 0 ? TRACK_W * 0.27 : TRACK_W * 0.73;
    // Vary angle slightly each ramp for unpredictability
    const angle = baseAngle + (Math.random() - 0.5) * 0.08;
    parts.push(tilt(cx, yStart + i * 220, rampW, 18, dir * angle, opts));
  }
  return parts;
}

function bumpers(yStart, rows, r) {
  const opts   = { isStatic: true, friction: 0.03, restitution: 0.75, label: 'bumper' };
  const rowGap = 100;
  const parts  = [];
  for (let i = 0; i < rows; i++) {
    const y = yStart + i * rowGap;
    parts.push(Bodies.circle(140 + (Math.random() - 0.5) * 20, y, r, opts));
    parts.push(Bodies.circle(TRACK_W - 140 + (Math.random() - 0.5) * 20, y, r, opts));
    if (i % 2 === 1) {
      parts.push(Bodies.circle(
        TRACK_W / 2 + (Math.random() - 0.5) * 60,
        y + rowGap / 2, r - 3, opts));
    }
  }
  return parts;
}

// Narrow section — ONLY angled ramps, no vertical walls (avoids wedge explosions)
// Creates a visual pinch without creating a physical trap
function narrowRamps(yStart, corridorW) {
  const opts   = { isStatic: true, friction: 0.15, restitution: 0.38, label: 'narrow' };
  const margin = (TRACK_W - corridorW) / 2;
  const rampW  = margin * 1.95;   // rampas mais longas — cobrem mais da pista
  const angle  = 0.52;
  // Par principal — inclinado fundo em direção ao centro
  const lR  = tilt(margin * 0.38, yStart + 25, rampW,        18, angle,  opts);
  const rR  = tilt(TRACK_W - margin * 0.38, yStart + 25, rampW,        18, -angle, opts);
  // Segundo par reforça o funil, levemente mais próximo ao centro
  const lR2 = tilt(margin * 0.52, yStart + 155, rampW * 0.68, 15,  0.46, opts);
  const rR2 = tilt(TRACK_W - margin * 0.52, yStart + 155, rampW * 0.68, 15, -0.46, opts);
  return [lR, rR, lR2, rR2];
}

function split(all, animated, yStart, height) {
  const half   = TRACK_W / 2;
  const rightCx = half + (TRACK_W - half) / 2;   // centro do canal direito (~525)
  const leftCx  = half / 2;                        // centro do canal esquerdo (~175)

  // ── Divisória central — termina 220px antes do fim para saída natural ─
  const dOpts = { isStatic: true, friction: 0.2, restitution: 0.3, label: 'divider' };
  const wallH = height - 220;
  all.push(Bodies.rectangle(half, yStart + wallH / 2, 14, wallH, dOpts));

  // Rampas de entrada — guiam bolas para esquerda ou direita
  all.push(tilt(half - 55, yStart - 45, 120, 14, -0.42, dOpts));
  all.push(tilt(half + 55, yStart - 45, 120, 14,  0.42, dOpts));

  // ── ESQUERDA — DIFÍCIL: pegs em zigzag + 2 bumpers espaçados ──────────
  // Passável mas lenta — bumpers com restitution baixo (sem armadilha)
  const lPeg  = { isStatic:true, friction:0.04, restitution:0.55, label:'peg' };
  const lBump = { isStatic:true, friction:0.03, restitution:0.62, label:'bumper' };
  const rows  = Math.floor(wallH / 170);
  for (let r = 0; r < rows; r++) {
    const y  = yStart + 110 + r * 170;
    // Zigzag: alterna posição horizontal para não bloquear coluna inteira
    const cx = r % 2 === 0 ? leftCx - 45 : leftCx + 45;
    all.push(Bodies.circle(cx, y, 11 + Math.random() * 2, lPeg));
  }
  // Apenas 2 bumpers, bem espaçados e longe das paredes
  all.push(Bodies.circle(leftCx + 30,  yStart + wallH * 0.32, 15, lBump));
  all.push(Bodies.circle(leftCx - 30,  yStart + wallH * 0.68, 15, lBump));

  // ── DIREITA — FÁCIL: ramp suave + booster + copo rotativo ─────────────
  const rRamp = { isStatic:true, friction:0.18, restitution:0.35, label:'ramp' };
  // Rampa que empurra as bolas pelo centro do canal
  all.push(tilt(rightCx - 10, yStart + wallH * 0.22, 160, 14, -0.22, rRamp));
  // Boost sensor no meio do canal direito
  all.push(Bodies.rectangle(rightCx, yStart + wallH * 0.48, 80, 30, {
    isStatic: true, isSensor: true, friction: 0, restitution: 0, label: 'boost',
  }));
  // Bumper central — pequeno atraso para quem caiu pelo lado fácil
  all.push(Bodies.circle(rightCx, yStart + wallH * 0.72, 18, {
    isStatic: true, friction: 0.03, restitution: 0.75, label: 'bumper',
  }));
  // Rampa suave na saída do canal direito
  all.push(tilt(rightCx + 20, yStart + wallH * 0.90, 140, 14, 0.20, rRamp));
  // Sem rampas de saída — divisória simplesmente termina e as bolas se reencontram
}

// Obstáculo X girante: duas barras cruzadas que giram continuamente
// Funciona como um moinho/spinner — bloqueia brevemente e libera as bolinhas
function addRotatingX(all, animated, cx, cy, speed = 0.8, phaseOffset = 0) {
  const barLen = 200;
  const barW   = 18;
  const opts   = { isStatic: true, friction: 0.03, restitution: 0.62, label: 'paddle' };

  const bar1 = Bodies.rectangle(cx, cy, barLen, barW, opts);
  const bar2 = Bodies.rectangle(cx, cy, barLen, barW, opts);
  all.push(bar1, bar2);

  animated.push({
    body: bar1,
    tick(t) {
      const a = t * speed + phaseOffset;
      Body.setPosition(bar1, { x: cx, y: cy });
      Body.setAngle(bar1, a);
    },
  });
  animated.push({
    body: bar2,
    tick(t) {
      const a = t * speed + phaseOffset + Math.PI / 2;
      Body.setPosition(bar2, { x: cx, y: cy });
      Body.setAngle(bar2, a);
    },
  });
}

// Boost gate: portão estreito | | — largura de ~2 bolinhas
// Só bolinhas que passam entre os postes ganham velocidade
// Copo rotativo: U → C → ∩ (cada posição 1 segundo, transição 0.3s)
// Cabe exatamente 1 bolinha. Captura a bola, depois a libera ao girar.
function addRotatingCup(all, animated, cx, cy, phaseOffset = 0) {
  const tw   = 10;
  const iw   = 30;          // largura interna: cabe 1 bolinha (r=10) com folga
  const hw   = iw / 2 + tw / 2;   // = 20, distância do centro ao meio do braço
  const armH = 52;
  const opts = { isStatic: true, friction: 0.03, restitution: 0.50, label: 'paddle' };

  const lArm = Bodies.rectangle(cx - hw, cy, tw, armH, opts);
  const rArm = Bodies.rectangle(cx + hw, cy, tw, armH, opts);
  const base = Bodies.rectangle(cx, cy + armH / 2, iw + tw * 2, tw, opts);
  all.push(lArm, rArm, base);

  function setCup(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const rot = (dx, dy) => ({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c });
    Body.setPosition(lArm, rot(-hw, 0));   Body.setAngle(lArm, theta);
    Body.setPosition(rArm, rot(+hw, 0));   Body.setAngle(rArm, theta);
    Body.setPosition(base, rot(0, armH / 2)); Body.setAngle(base, theta);
  }

  const HOLD  = 1.0;
  const TRANS = 0.30;
  const CYCLE = HOLD + TRANS;
  // ping-pong: U(0) → C(π/2) → ∩(π) → C(π/2) → U(0) → …
  const ANGLES = [0, Math.PI / 2, Math.PI, Math.PI / 2];

  animated.push({
    body: lArm,
    tick(t) {
      const tp    = (t + phaseOffset) % (ANGLES.length * CYCLE);
      const idx   = Math.floor(tp / CYCLE) % ANGLES.length;
      const prog  = Math.min((tp % CYCLE) / TRANS, 1);
      const ease  = prog < 0.5 ? 2 * prog * prog : -1 + (4 - 2 * prog) * prog;
      const from  = ANGLES[idx];
      const to    = ANGLES[(idx + 1) % ANGLES.length];
      setCup(from + (to - from) * ease);
    },
  });
}

// Copo grande para o Village — boca 60px (3× maior), braços 72px
// Captura muito mais bolinhas graças à abertura generosa
function addRotatingCupLarge(all, animated, cx, cy, phaseOffset = 0) {
  const tw   = 13;
  const iw   = 60;             // boca 2× maior → captura bolinhas que passam perto
  const hw   = iw / 2 + tw / 2;
  const armH = 72;
  const opts = { isStatic: true, friction: 0.03, restitution: 0.45, label: 'paddle' };

  const lArm = Bodies.rectangle(cx - hw, cy, tw, armH, opts);
  const rArm = Bodies.rectangle(cx + hw, cy, tw, armH, opts);
  const base = Bodies.rectangle(cx, cy + armH / 2, iw + tw * 2, tw, opts);
  all.push(lArm, rArm, base);

  function setCup(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    const rot = (dx, dy) => ({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c });
    Body.setPosition(lArm, rot(-hw, 0));     Body.setAngle(lArm, theta);
    Body.setPosition(rArm, rot(+hw, 0));     Body.setAngle(rArm, theta);
    Body.setPosition(base, rot(0, armH / 2)); Body.setAngle(base, theta);
  }

  const HOLD  = 1.2;
  const TRANS = 0.35;
  const CYCLE = HOLD + TRANS;
  const ANGLES = [0, Math.PI / 2, Math.PI, Math.PI / 2];

  animated.push({
    body: lArm,
    tick(t) {
      const tp   = (t + phaseOffset) % (ANGLES.length * CYCLE);
      const idx  = Math.floor(tp / CYCLE) % ANGLES.length;
      const prog = Math.min((tp % CYCLE) / TRANS, 1);
      const ease = prog < 0.5 ? 2 * prog * prog : -1 + (4 - 2 * prog) * prog;
      setCup(ANGLES[idx] + (ANGLES[(idx + 1) % ANGLES.length] - ANGLES[idx]) * ease);
    },
  });
}

// ── Alphabet Village ─────────────────────────────────────────────────────────
// Letras Z X Y T M compostas por barras, girando continuamente como ponteiros.
// recipe: array de { dx, dy, localAngle, w } — posição/ângulo relativos ao centro.
// A letra inteira gira junta em torno de (cx, cy) com `speed` rad/s.

const _BW = 12; // espessura padrão das barras

function _addRotatingLetter(all, animated, cx, cy, recipe, speed, phase) {
  const opts = { isStatic: true, friction: 0.03, restitution: 0.60, label: 'paddle' };
  const bodies = recipe.map(r =>
    Bodies.rectangle(cx + r.dx, cy + r.dy, r.w, _BW, opts)
  );
  bodies.forEach(b => all.push(b));
  animated.push({
    body: bodies[0],
    tick(t) {
      const theta = t * speed + phase;
      const c = Math.cos(theta), s = Math.sin(theta);
      for (let i = 0; i < bodies.length; i++) {
        const r = recipe[i];
        Body.setPosition(bodies[i], {
          x: cx + r.dx * c - r.dy * s,
          y: cy + r.dx * s + r.dy * c,
        });
        Body.setAngle(bodies[i], theta + r.localAngle);
      }
    },
  });
}

function _letterZ(s) {
  return [
    { dx: 0, dy: -s * 0.40, localAngle: 0,            w: s * 1.25 },  // topo —
    { dx: 0, dy:  0,        localAngle: -Math.PI / 4,  w: s * 1.55 },  // diagonal /
    { dx: 0, dy:  s * 0.40, localAngle: 0,             w: s * 1.25 },  // base —
  ];
}
function _letterX(s) {
  return [
    { dx: 0, dy: 0, localAngle:  Math.PI / 4, w: s * 1.45 },  // barra \
    { dx: 0, dy: 0, localAngle: -Math.PI / 4, w: s * 1.45 },  // barra /
  ];
}
function _letterY(s) {
  return [
    { dx: -s * 0.27, dy: -s * 0.27, localAngle:  Math.PI / 4, w: s * 0.90 },  // braço \
    { dx:  s * 0.27, dy: -s * 0.27, localAngle: -Math.PI / 4, w: s * 0.90 },  // braço /
    { dx:  0,        dy:  s * 0.22, localAngle:  Math.PI / 2,  w: s * 0.70 },  // haste |
  ];
}
function _letterT(s) {
  return [
    { dx: 0, dy: -s * 0.28, localAngle: 0,           w: s * 1.40 },  // topo —
    { dx: 0, dy:  s * 0.22, localAngle: Math.PI / 2,  w: s * 0.85 },  // haste |
  ];
}
function _letterM(s) {
  return [
    { dx: -s * 0.42, dy:  0,        localAngle: Math.PI / 2,  w: s       },  // vertical esq
    { dx:  s * 0.42, dy:  0,        localAngle: Math.PI / 2,  w: s       },  // vertical dir
    { dx: -s * 0.20, dy: -s * 0.30, localAngle:  Math.PI / 4, w: s * 0.65 },  // diag esq \
    { dx:  s * 0.20, dy: -s * 0.30, localAngle: -Math.PI / 4, w: s * 0.65 },  // diag dir /
  ];
}

function addBoostGate(all, cx, y) {
  const gapW  = 46;   // ~2.3 diâmetros de bolinha
  const poleH = 70;
  const poleW = 10;
  const pOpts = { isStatic: true, friction: 0.1, restitution: 0.4, label: 'peg' };

  // Poste esquerdo |
  all.push(Bodies.rectangle(cx - gapW / 2 - poleW / 2, y, poleW, poleH, pOpts));
  // Poste direito |
  all.push(Bodies.rectangle(cx + gapW / 2 + poleW / 2, y, poleW, poleH, pOpts));

  // Trigger de boost: sensor — detecta passagem e dá velocidade, NÃO bloqueia fisicamente
  const bOpts = { isStatic: true, isSensor: true, friction: 0, restitution: 0, label: 'boost' };
  const trigger = Bodies.rectangle(cx, y, gapW - 10, poleH - 4, bOpts);
  trigger.boostDir = { x: 0, y: 1 };
  all.push(trigger);
}

function wallGuards(yStart, yEnd, spacing) {
  const opts = { isStatic: true, friction: 0.04, restitution: 0.60, label: 'peg' };
  const r = 9;
  const parts = [];
  for (let y = yStart; y < yEnd; y += spacing) {
    const jy = (Math.random() - 0.5) * spacing * 0.4;
    parts.push(Bodies.circle(22 + Math.random() * 10, y + jy, r, opts));
    parts.push(Bodies.circle(TRACK_W - 22 - Math.random() * 10, y + jy, r, opts));
  }
  return parts;
}

function finalFunnel(y) {
  const opts = { isStatic: true, friction: 0.18, restitution: 0.32, label: 'final-funnel' };
  return [
    tilt(140, y + 60, 280, 16,  0.5, opts),
    tilt(560, y + 60, 280, 16, -0.5, opts),
  ];
}

function tilt(x, y, w, h, angle, opts) {
  const b = Bodies.rectangle(x, y, w, h, opts);
  Body.setAngle(b, angle);
  return b;
}
