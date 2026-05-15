const { Bodies, Body, Composite, Vector } = Matter;
import { BALL_R, TRACK_W } from './track.js';

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export let balls = [];

export function createBalls(names, colors, world) {
  balls = [];
  names.forEach((name, i) => {
    // Drop randomly inside the container zone (x: 120–580, above the gate)
    const x = BALL_R * 3 + Math.random() * (TRACK_W - BALL_R * 6);
    const y = -BALL_R * 2 - Math.random() * 200;
    const body = Bodies.circle(x, y, BALL_R, {
      restitution: 0.65,
      friction: 0.04,
      frictionAir: 0.010,   // menos resistência → mais bolinhas mantêm ritmo
      density: 0.002,
      label: `ball_${i}`,
    });
    Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 2,
      y: Math.random() * 1.5,
    });
    const ball = {
      body,
      name,
      color: colors[i],
      initial: getInitials(name),
      index: i,
      finishPos: null,
      stuckTimer: 0,
    };
    balls.push(ball);
    Composite.add(world, body);
  });
  return balls;
}

export function removeBalls(world) {
  for (const b of balls) Composite.remove(world, b.body);
  balls = [];
}

const STUCK_V    = 0.40;
const STUCK_MS   = 700;    // destrava mais rápido → mais bolinhas chegam ao fim
const NUDGE      = 0.010;  // impulso suave
const NUDGE_HARD = 0.032;  // impulso forte (segundo nível)
const STUCK_HARD = 1800;   // ms parada para acionar impulso forte
const MAX_SPEED  = 13;     // px/tick cap — prevents physics explosions from wedges

export function tickFailsafe(delta) {
  for (const ball of balls) {
    if (ball.finishPos !== null) continue;
    const v   = ball.body.velocity;
    const spd = Vector.magnitude(v);

    // Hard speed cap — prevents wedge/ramp launch artifacts
    if (spd > MAX_SPEED) {
      Body.setVelocity(ball.body, { x: v.x / spd * MAX_SPEED, y: v.y / spd * MAX_SPEED });
    }

    // Boundary escape fix — tunneling through walls at high velocity
    const px = ball.body.position.x;
    const py = ball.body.position.y;
    if (px < BALL_R + 2) {
      Body.setPosition(ball.body, { x: BALL_R + 4, y: py });
      Body.setVelocity(ball.body, { x: Math.abs(v.x) + 1, y: v.y });
    } else if (px > TRACK_W - BALL_R - 2) {
      Body.setPosition(ball.body, { x: TRACK_W - BALL_R - 4, y: py });
      Body.setVelocity(ball.body, { x: -(Math.abs(v.x) + 1), y: v.y });
    }

    if (spd < STUCK_V) {
      ball.stuckTimer += delta;

      if (ball.stuckTimer > STUCK_HARD) {
        // Nível 2: impulso bem mais forte + componente horizontal aleatório maior
        Body.applyForce(ball.body, ball.body.position, {
          x: (Math.random() - 0.5) * NUDGE_HARD * 2,
          y: NUDGE_HARD * 3,
        });
        ball.stuckTimer = 0;
      } else if (ball.stuckTimer > STUCK_MS) {
        // Nível 1: impulso suave para deslocar
        Body.applyForce(ball.body, ball.body.position, {
          x: (Math.random() - 0.5) * NUDGE,
          y: NUDGE * 2.5,
        });
        ball.stuckTimer = STUCK_MS; // não reseta, acumula para nível 2
      }
    } else {
      ball.stuckTimer = 0;
    }
  }
}
