# Sorteador por Corrida de Bolinhas (Marble Race)

**Data:** 2026-05-14
**Status:** concluída (v1)

## Contexto
Sorteador visual onde até 100 participantes são representados por bolinhas que disputam uma corrida 2D com física real. O resultado é determinado pela ordem de chegada.

## Requisitos Funcionais
- [x] RF-01: Tela de entrada aceita até 100 nomes (textarea, um por linha)
- [x] RF-02: Cada participante = bolinha colorida com inicial
- [x] RF-03: Fase container — bolinhas caem num funil antes da corrida
- [x] RF-04: Contagem regressiva animada (3, 2, 1, GO!)
- [x] RF-05: Pista vertical com obstáculos (pinos, rampas, bumpers, estreitamentos)
- [x] RF-06: Física real com Matter.js (gravidade, colisões, fricção)
- [x] RF-07: Painel lateral com ranking em tempo real
- [x] RF-08: Bolinhas que ficam para trás aparecem rebaixadas no ranking
- [x] RF-09: Posição registrada ao cruzar a linha de chegada
- [x] RF-10: Tela final com Top 3 (pódio animado)
- [x] RF-11: Botão "Nova Corrida" para reiniciar

## Requisitos Não-Funcionais
- [x] RNF-01: ≥30fps com 100 bolinhas
- [x] RNF-02: Obstáculos nunca bloqueiam completamente o caminho
- [x] RNF-03: Sempre chegam ao menos 3 bolinhas (garantia por design + failsafe)
- [x] RNF-04: Roda no browser sem instalação (HTML + JS puro)
- [x] RNF-05: Cor única e identificação visível por bolinha

## Fora de Escopo (v1)
- Sem som/música
- Sem persistência de histórico
- Sem modo 3D
- Sem app mobile nativo

## Critérios de Aceite
- [x] CA-01: 100 participantes rodando fluido ≥30fps no Chrome
- [x] CA-02: Nunca menos de 3 finalistas
- [x] CA-03: Ranking lateral atualiza em tempo real
- [x] CA-04: Top 3 final exibe corretamente os primeiros a cruzar a linha
- [x] CA-05: Fase container visualmente distinta da corrida
