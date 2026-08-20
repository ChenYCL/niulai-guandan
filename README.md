# Niulai Guandan

[English](README.md) · [中文](README.zh.md) · [日本語](README.ja.md)

A small Node table for four-player team Guandan. The felt is themed on the 2026 film *Niulai*, but the code is ordinary: Express, Socket.IO, no build step.

Fan work. Card faces are cropped stills from [niulai.co](https://niulai.co/), not generated lookalikes.

![Final card faces](docs/card-faces.png)

## Why this repo exists

Most Guandan clones ship generic pips. This one maps the yellow calf onto every suit, grades the two jokers so they read as kings (gold / cold silver), and deals with a visible arc instead of cards popping in.

If you just want to play, [a live table is up](https://ends-dresses-rules-termination.trycloudflare.com). Create a room and hit start. Three robots sit down. Language pills on the lobby: 中 / 日 / EN.

| Card | Face |
| --- | --- |
| Hearts | Deadpan calf (Niulai) |
| Diamonds | Open-mouth shock |
| Clubs | Vacant stare |
| Spades | Unimpressed side-eye |
| Little Joker | Half-lidded cold stare, silver rim |
| Big Joker | Side-eye, gold grade, gold rim |
| Heart K | Softer portrait (Mom) |
| Heart Q / J | Second calf (Niu2) |

## What is implemented

Room codes, same-seat reconnect, disconnect → auto-play, 90s human timeout, tribute (no anti-tribute), bombs, hints, optional mic (WebRTC). Portrait hands wrap to two rows.

Scoring on this table: double-down +3, 1st+3rd +2, 1st+4th +1. Play up through A, then one more winning deal ends the match. Heart of the current level is wild.

## Run locally

```bash
npm install
npm start
```

Listens on `0.0.0.0:8787` (or `PORT`). `npm run check` runs syntax + combo tests.

## Deploy (Node, not Pages)

GitHub Pages cannot host this. You need a process that speaks WebSockets.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ChenYCL/niulai-guandan)

`render.yaml` + `Procfile` are in the repo. GitHub Actions (Node 20) will CI on push; a deploy job curls `RENDER_DEPLOY_HOOK` when that secret exists, otherwise it skips and stays green.

## Credit

*Niulai* designs belong to their rights holders. Stills via niulai.co. Style notes: [GoodTimeGGB/niulai-style](https://github.com/GoodTimeGGB/niulai-style).

