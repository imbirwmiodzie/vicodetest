# Animation demos: Remotion vs HyperFrames vs Revideo

Two animations, each built with all three tools:

- **Centro Business 3.0 setup** (`*/dist-demo/router.html`): Ethernet cable into a LAN port,
  the TCL LinkKey IK41 into the USB 2.0 port, then the stick moved onto a USB extension cable.
  The scene lives in `shared/` (timeline, geometry, camera) so all three play the same animation;
  Remotion and HyperFrames draw it with CSS 3D, Revideo projects it onto its canvas.
- **Status card** (`*/dist-demo/`): the benchmark animation from `PLAN.md`.

## Run on your PC

Needs Node.js 20.19+ or 22.13+ (with npm) and curl.

```sh
# Linux / macOS
sh benchmark/demo.sh
```

```bat
:: Windows (cmd or double-click)
benchmark\demo.cmd
```

The script downloads the product photos, installs and builds the three demos, and serves
`benchmark/` at http://localhost:8080/ (`PORT=...` to change). The start page links all demos.

### Photos

`media/fetch.sh` (or `media\fetch.cmd`) downloads them with curl into `media/`:

| File | Source |
|---|---|
| `cb3-back.png` | Centro Business 3.0 back panel, [cb-guide.swisscom.ch](https://cb-guide.swisscom.ch/en/router/router_installation) |
| `tcl-ik41-front.jpeg` | TCL LinkKey IK41 front, [komsa.pl product page](https://www.komsa.pl/producenci/TCL/TCL-Router-przeno%C5%9Bny-IK41-czarny-IK41VE1-2ALCPL2/) |
| `tcl-ik41-edge.jpeg` | TCL LinkKey IK41 edge with the LTE antenna sockets, same page |

They belong to Swisscom and TCL/KOMSA and are not committed to this repo.

## Live config

Every demo page fetches its config at runtime (`config/router.json`, `config/config.json`) and has
an editor under the player. For the router demo: port (1-5; `{port}` in `step1` is replaced),
cable / LED / accent colours, caption texts, speed and loop. Editing the JSON file and reloading
works on the production build without rebuilding.
