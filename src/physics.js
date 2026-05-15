const { Engine, Runner, World } = Matter;

let engine, runner;

export function initPhysics() {
  engine = Engine.create({ gravity: { y: 0.58 } });
  runner = Runner.create({ delta: 1000 / 60 });
  return { engine, runner };
}

export function startRunner() {
  Runner.run(runner, engine);
}

export function stopRunner() {
  if (runner) Runner.stop(runner);
}

export function resetWorld() {
  if (runner) Runner.stop(runner);
  if (engine) World.clear(engine.world, false);
  if (engine) Engine.clear(engine);
  engine = null;
  runner = null;
}

export function getEngine() { return engine; }
export function getWorld()  { return engine?.world; }

export function setupBoostCollisions() {
  if (!engine) return;
  Matter.Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;
      const ball  = bodyA.label?.startsWith('ball_') ? bodyA : bodyB.label?.startsWith('ball_') ? bodyB : null;
      const boost = bodyA.label === 'boost' ? bodyA : bodyB.label === 'boost' ? bodyB : null;
      if (!ball || !boost) continue;
      const v = ball.velocity;
      Matter.Body.setVelocity(ball, { x: v.x * 0.5, y: Math.min(v.y + 8, 18) });
    }
  });
}
