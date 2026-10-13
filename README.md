# Voxlet

An original, open-source block building sandbox that runs in the browser, with a built-in client menu (FPS counter, coordinates, click counter, keystrokes, zoom, toggle sprint, field of view and render distance) and optional multiplayer on a server you host yourself.

All code, textures and the block world are original. The textures are generated in code at startup. Rendering uses [three.js](https://threejs.org) (MIT), bundled in `vendor/`. It contains no Mojang or Minecraft code or assets.

There are no cheat features. The server validates block edits (reach, bounds, block ids) and rate-limits messages.

## Play solo

Open the folder with any static server and visit `index.html`:

```
python3 -m http.server 8000
```

## Host a multiplayer server

```
cd server
npm install
PORT=8080 npm start
```

Then enter `ws://YOUR-HOST:8080` in the Multiplayer box on the title screen. Put the server behind a TLS proxy to use `wss://` when the page is served over HTTPS. Optional environment variables: `SEED`, `MAX_PLAYERS`.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move |
| Space, double tap Space | Jump, toggle flying |
| Shift | Sprint (flying: descend) |
| Left click / right click | Break / place block |
| 1 to 9, mouse wheel | Choose block |
| C (hold) | Zoom |
| M | Client menu |

If the browser blocks cursor capture (for example inside an embedded frame), hold the left mouse button and drag to look; a click without movement breaks a block.

## License

MIT. three.js is MIT licensed, see `vendor/THREE-LICENSE`.
