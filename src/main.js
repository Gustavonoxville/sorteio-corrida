import { generateColors }  from './colors.js';
import { initPhysics, startRunner, resetWorld, getWorld, setupBoostCollisions } from './physics.js';
import { buildTrack, openGate, handicapState } from './track.js';
import { createBalls, balls, tickFailsafe } from './balls.js';
import { startRenderer, stopRenderer, resetCamera, setRaceStartTime, clearRaceTime, retireTrail, setWinnerCount, setBroadcastMode } from './renderer.js';
import { checkFinishLine, renderRanking, getSortedRanking } from './ranking.js';
import { showScreen, runCountdown, showPodium } from './ui.js';

let state         = 'INPUT';
let finishedCount = 0;
let winnerCount   = 3;    // quantos vencedores até encerrar a corrida
let lastTick      = performance.now();
let gate          = null;
let animated      = [];   // { body, tick(t) }
let raceStartTime = 0;    // performance.now() at GO!
let safetyTimeout = null; // ID do timeout de segurança — cancelado ao reiniciar

// ── Input screen ───────────────────────────────────────────────────────────
const textarea = document.getElementById('participants-input');
const btnStart  = document.getElementById('btn-start');
const countLbl  = document.getElementById('count-label');

const DEMO_NAMES = [
  'Alice Mendonça Ferreira Santos Lima',
  'Bruno Carvalho Oliveira Souza Nunes',
  'Carlos Andrade Ribeiro Alves Costa',
  'Diana Ferreira Pereira Gomes Borges',
  'Eduardo Nascimento Martins Teixeira Rocha',
  'Fernanda Oliveira Lima Castro Dias',
  'Gabriel Souza Barbosa Freitas Moreira',
  'Helena Ribeiro Cardoso Cunha Ramos',
  'Igor Martins Azevedo Fonseca Lopes',
  'Juliana Costa Brito Silveira Torres',
  'Karla Pereira Nogueira Vasconcelos Melo',
  'Leonardo Alves Guimarães Cavalcanti Miranda',
  'Mariana Lima Batista Duarte Siqueira',
  'Nicolas Barbosa Correia Moraes Araújo',
  'Olivia Rocha Macedo Monteiro Campos',
  'Paulo Gomes Santana Vieira Pinto',
  'Queila Nunes Teixeira Cunha Borges',
  'Rafael Torres Alves Ribeiro Fonseca',
  'Sabrina Dias Oliveira Pereira Castro',
  'Thiago Moreira Souza Martins Gomes',
  'Ursula Campos Lima Ferreira Batista',
  'Victor Castro Nogueira Ramos Freitas',
  'Wanda Freitas Barbosa Lopes Duarte',
  'Xavier Lopes Correia Rocha Azevedo',
  'Yasmin Cardoso Miranda Silveira Brito',
  'Zeca Borges Vieira Macedo Araújo',
  'Aline Pinto Guimarães Santos Teixeira',
  'Bernardo Cunha Cavalcanti Dias Moraes',
  'Cintia Ramos Fonseca Monteiro Pereira',
  'Danilo Azevedo Batista Vasconcelos Costa',
  'Elisa Fonseca Torres Cunha Oliveira',
  'Fábio Melo Ribeiro Martins Santana',
  'Gisele Teixeira Pinto Borges Castro',
  'Hudson Vieira Souza Alves Campos',
  'Irene Macedo Lima Ferreira Rocha',
  'Jonas Correia Nogueira Freitas Gomes',
  'Kelly Santana Barbosa Duarte Lopes',
  'Lucas Monteiro Moraes Cardoso Ramos',
  'Marta Silveira Guimarães Brito Ferreira',
  'Nando Araújo Cavalcanti Dias Ribeiro',
  'Ofélia Brito Pereira Vieira Cunha',
  'Pedro Batista Azevedo Siqueira Oliveira',
  'Quitéria Duarte Correia Teixeira Lima',
  'Rodrigo Nogueira Miranda Torres Martins',
  'Stella Vasconcelos Fonseca Campos Borges',
  'Tadeu Siqueira Ramos Silveira Souza',
  'Úrsula Miranda Batista Moreira Castro',
  'Vera Moraes Monteiro Freitas Alves',
  'Wilson Guimarães Lopes Barbosa Pinto',
  'Xisto Cavalcanti Costa Macedo Santana',
  'Adriana Fonseca Vasconcelos Braga Pinto',
  'Benedito Lemos Cavalcante Siqueira Rocha',
  'Camila Nogueira Azevedo Teixeira Freitas',
  'Davi Correia Monteiro Pinheiro Barbosa',
  'Estela Ribeiro Batista Carvalho Cunha',
  'Felipe Macedo Guimarães Torres Alves',
  'Giovana Pinto Souza Moreira Santos',
  'Henrique Borges Lima Ferreira Duarte',
  'Isabel Ramos Oliveira Pereira Castro',
  'Joaquim Lopes Silveira Gomes Nunes',
  'Lara Martins Cunha Vieira Rocha',
  'Mateus Cardoso Nogueira Campos Ribeiro',
  'Natalia Freitas Monteiro Souza Borges',
  'Octavio Duarte Ferreira Brito Macedo',
  'Patricia Siqueira Guimarães Alves Lima',
  'Quintino Batista Vasconcelos Torres Cunha',
  'Renata Azevedo Pinheiro Correia Fonseca',
  'Sandro Cavalcante Lemos Ribeiro Braga',
  'Tatiana Moreira Cardoso Pereira Dias',
  'Ulisses Gomes Barbosa Silveira Santos',
  'Vanessa Rocha Teixeira Campos Oliveira',
  'Wagner Freitas Borges Nunes Martins',
  'Xerxes Pinto Lima Ferreira Guimarães',
  'Yolanda Correia Macedo Batista Castro',
  'Zilmar Vieira Torres Ramos Siqueira',
  'Augusto Nogueira Cunha Duarte Carvalho',
  'Bianca Lopes Alves Moreira Teixeira',
  'Cássio Ribeiro Monteiro Azevedo Pereira',
  'Dalila Fonseca Santos Rocha Barbosa',
  'Emanoel Gomes Brito Lemos Correia',
  'Fabiana Campos Borges Vasconcelos Cunha',
  'Gregório Silveira Pinheiro Batista Freitas',
  'Hortência Duarte Cardoso Ferreira Lima',
  'Ismael Alves Cavalcante Nogueira Monteiro',
  'Joice Macedo Torres Siqueira Ribeiro',
  'Kleber Martins Guimarães Rocha Santos',
  'Luciana Pereira Correia Gomes Borges',
  'Murilo Batista Azevedo Teixeira Lopes',
  'Norma Cunha Carvalho Freitas Duarte',
  'Orlando Ramos Moreira Barbosa Campos',
  'Priscila Vasconcelos Lima Braga Fonseca',
  'Quirino Ferreira Lemos Correia Silveira',
  'Rosana Brito Pinheiro Nogueira Torres',
  'Silvio Cardoso Borges Alves Cunha',
  'Teresa Monteiro Rocha Santos Batista',
  'Umberto Guimarães Siqueira Pereira Gomes',
  'Viviane Azevedo Teixeira Macedo Freitas',
  'Wellington Barbosa Correia Ribeiro Carvalho',
  'Zenaide Duarte Campos Lemos Cavalcante',
  'Arnaldo Vieira Monteiro Rocha Pinheiro',
];

document.getElementById('btn-demo').addEventListener('click', () => {
  textarea.value = DEMO_NAMES.join('\n');
  textarea.dispatchEvent(new Event('input'));
});

textarea.addEventListener('input', () => {
  const names = parseNames(textarea.value);
  const n = names.length;
  countLbl.textContent = `${n} participante${n !== 1 ? 's' : ''}`;
  btnStart.disabled = n < 2 || n > 100;
});

btnStart.addEventListener('click', () => {
  startRace(parseNames(textarea.value));
});

document.getElementById('btn-restart').addEventListener('click', () => {
  showScreen('screen-input');
  state = 'INPUT';
});

// Modo TV — toggle durante a corrida
let _broadcastOn = false;
document.getElementById('btn-broadcast').addEventListener('click', () => {
  _broadcastOn = !_broadcastOn;
  setBroadcastMode(_broadcastOn);
});

function parseNames(raw) {
  return raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 100);
}

// ── Race bootstrap ─────────────────────────────────────────────────────────
function startRace(names) {
  // Lê configuração de vencedores do dropdown
  winnerCount = parseInt(document.getElementById('winner-count').value, 10) || 3;
  setWinnerCount(winnerCount);

  // Cancela timeout de segurança de corridas anteriores
  if (safetyTimeout !== null) { clearTimeout(safetyTimeout); safetyTimeout = null; }
  resetWorld();
  resetCamera();
  finishedCount = 0;
  gate = null;
  animated = [];

  initPhysics();
  setupBoostCollisions();
  const world = getWorld();
  const track = buildTrack(world);
  gate     = track.gate;
  animated = track.animated;

  const colors = generateColors(names.length);
  createBalls(names, colors, world);

  state = 'DROP_INTRO';
  showScreen('screen-race');
  startRunner();

  setTimeout(() => {
    state = 'COUNTDOWN';
    runCountdown(() => {
      if (gate) { openGate(world); gate = null; }
      raceStartTime = performance.now();
      setRaceStartTime(raceStartTime);
      state = 'RACING';
    });
  }, 2800);

  startRenderer(onFrame);
}

// ── Per-frame ──────────────────────────────────────────────────────────────
function onFrame(now) {
  const delta = now - lastTick;
  lastTick = now;

  if (state === 'RACING') {
    const t = (now - raceStartTime) / 1000;   // seconds since GO!
    for (const anim of animated) anim.tick(t); // move paddles & clock hands
    tickFailsafe(delta);
    checkFinishLine(onBallFinish);
    renderRanking(now);

    // ── Balanceamento (carets + velocidade) — só antes de alguém cruzar ──
    const ninguemTerminou = balls.every(b => b.finishPos === null);

    // Encontra líder e 2º em O(n)
    let leader = null, second = null;
    for (const ball of balls) {
      if (ball.finishPos !== null) continue;
      const y = ball.body.position.y;
      if (!leader || y > leader.body.position.y) { second = leader; leader = ball; }
      else if (!second || y > second.body.position.y) { second = ball; }
    }
    const gap    = (leader && second) ? leader.body.position.y - second.body.position.y : 0;
    const THRESH = 600;

    // 1) Handicap de carets — disparo único com cooldown
    if (ninguemTerminou && leader && second && gap > THRESH) {
      const cooldown = performance.now() - handicapState.lastFiredAt;
      if (cooldown > handicapState.COOLDOWN_MS) {
        handicapState.leaderX     = leader.body.position.x;
        handicapState.lastFiredAt = performance.now();
      }
    }

    // 2) Balanceamento de velocidade — contínuo enquanto a vantagem persistir
    // Líder perde ~5% de velocidade terminal; demais ganham ~5%
    // (frictionAir terminal ∝ gravity / frictionAir → ajuste inverso de 5%)
    const FR_NORMAL = 0.0100;
    const FR_SLOW   = 0.0106; // /0.95 → ~5% mais lento
    const FR_FAST   = 0.0095; // /1.05 → ~5% mais rápido
    for (const ball of balls) {
      if (ball.finishPos !== null) continue;
      const isLeader = leader && ball.index === leader.index;
      ball.body.frictionAir = (ninguemTerminou && gap > THRESH)
        ? (isLeader ? FR_SLOW : FR_FAST)
        : FR_NORMAL;
    }
  } else if (state === 'DROP_INTRO' || state === 'COUNTDOWN') {
    renderRanking(now);
  }
}

function onBallFinish(ball, pos) {
  // Aposenta o rastro que rastreava esta bolinha — antes do próximo render()
  retireTrail(ball);
  finishedCount++;
  if (finishedCount === winnerCount) {
    state = 'FINISHED';
    showFinalPodium();          // pódio imediato após os N vencedores cruzarem
  }
  if (finishedCount === 1) {
    safetyTimeout = setTimeout(() => { safetyTimeout = null; if (state === 'RACING') { state = 'FINISHED'; showFinalPodium(); } }, 600000); // 10min — só segurança, não é limitante
  }
}

function showFinalPodium() {
  stopRenderer();
  clearRaceTime();
  const top3 = getSortedRanking().slice(0, winnerCount);
  showPodium(top3, () => {
    resetWorld();
    showScreen('screen-input');
    state = 'INPUT';
  });
}
