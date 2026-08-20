# Niulai Guandan

A four-player, two-team **Guandan** web game themed on the 2026 Chinese animated film *Niulai* (《牛来》). Create a room, share a 4-digit code, and start even if you are the only human — three robots fill empty seats.

This is a fan-made table. Card faces are retouched stills of the yellow calf from [niulai.co](https://niulai.co/), not generated lookalikes.

![Final card faces](docs/card-faces.png)

## Card faces

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

The jokers are the same film stills, graded harder so they read as the two kings of the deck: gold and heavy for the Big Joker, cool silver for the Little Joker.

Source sheet (16 knocked-out stills):

![Source set](docs/source-set.png)

## Features

- Room codes, reconnect to the same seat, instant auto-play on disconnect
- One-click start with three robots
- Portrait and landscape play; two-row hand in portrait
- Arced deal and play flights with gold motion trails
- Deal flies card backs first, then the whole hand flips
- Bombs, ranking banners, hints, 90s human-turn timeout then auto-play
- Tribute after a non-double-down game (no anti-tribute)
- Optional voice (WebRTC mesh). Refuse the mic and you can still play

## Rules (this table)

Two decks, 108 cards, 27 each. Level ranks run 2 through A. The heart of the current level is wild.

Legal shapes: single, pair, triple, triple+pair, straight, consecutive pairs, steel plate, airplane, 4–10 bombs, three-joker bomb, four-joker bomb.

First deal leads from the spade 3. Later deals lead from the previous winner. Scoring: double-down +3, 1st+3rd +2, 1st+4th +1. Climb to A, then win one more game to take the match.

## Run

```bash
npm install
npm start
```

Opens on `http://HOST:8787` (listens on `0.0.0.0:8787`). Copy the invite from the table HUD.

```bash
npm run check
```

runs a syntax check plus combo tests.

## Stack

Node, Express, Socket.IO, vanilla front-end. No build step. Theme art lives in `public/art/`; mapping is in `public/theme.js`.

## Credit

*Niulai* (《牛来》) character designs belong to their rights holders. Faces were taken from public meme stills on [niulai.co](https://niulai.co/) and cropped / background-removed for card use. Style notes also draw on [GoodTimeGGB/niulai-style](https://github.com/GoodTimeGGB/niulai-style).
