# Design Técnico — Marble Race

## Stack
| Camada | Tecnologia |
|--------|-----------|
| Física | Matter.js 0.19 (CDN) |
| Renderização | Canvas 2D API (custom loop) |
| UI | Vanilla JS + HTML/CSS |

## Máquina de Estados
INPUT → DROP_INTRO → COUNTDOWN → RACING → FINISHED

## Arquivos
- `index.html` — estrutura, 3 screens (input/race/podium)
- `style.css` — dark theme, layout grid/flex
- `src/main.js` — orquestrador, state machine
- `src/physics.js` — Matter.js Engine/Runner/World
- `src/track.js` — pista + obstáculos estáticos (TRACK_W=700, TRACK_H=4000)
- `src/balls.js` — criação de corpos + failsafe anti-trava
- `src/renderer.js` — loop rAF, câmera suave seguindo top-15% das bolinhas
- `src/ranking.js` — sort por Y, detecção da linha de chegada (FINISH_Y=3880)
- `src/ui.js` — countdown overlay, pódio, show/hide screens
- `src/colors.js` — 100 cores distintas por golden angle HSL

## Pista (zonas)
1. Container/funil (y 0–400): bolinhas aguardam
2. Pegs pachinko (y 500–900): grade triangular 6×6
3. Rampas diagonais alternadas (y 950–1300)
4. Bumper pairs + centro (y 1350–1700)
5. Canais estreitos (y 1750–2100): throat mínimo = BALL_R*4
6. Dense peg field (y 2150–2500)
7. Slalom gates (y 2550–2900)
8. Funil final aberto (y 3580–3700): garante passagem

## Garantia dos 3 finalistas
- Todos os obstáculos com MIN_GAP = BALL_R * 4
- Failsafe: bolinha com speed < 0.4 por > 2.2s recebe impulso descendente
- Timeout de 60s força encerramento com quem estiver na frente
