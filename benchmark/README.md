# Animation demos: Remotion vs HyperFrames vs Revideo

Two animations, each built with all three tools:

- **Centro Business 3.0 setup** (`*/dist-demo/router.html`): Ethernet cable into a LAN port,
  the TCL LinkKey IK41 into the front (or back) USB port, then the stick plugged into a USB
  extension cable, the cable into the router, and a hand carrying the stick to a window. Or, with
  `modem: "receiver"`, a 5G Receiver mounted outside the window and connected via a PoE adapter to port 4.
  The scene lives in `shared/` (timeline, geometry, camera) so all three play the same animation;
  Remotion and HyperFrames draw it with CSS 3D, Revideo projects it onto its canvas.
- **Status card** (`*/dist-demo/`): the benchmark animation from `PLAN.md`.

One more, HyperFrames only for now:

- **Connection table full** (`hyperframes/dist-demo/conntrack.html`): a 2D network diagram with LAN
  hosts (Alice, Bob on a video call, Mallory's infected PC), the router opened up ("inside the router": LAN
  ports, the conntrack check, the NAT table with protocol, LAN IP:port, router WAN IP:port, remote IP:port,
  state and a ticking timeout), and the internet (the site, attackers). Cases: normal use; Mallory floods
  the internet and fills the table, so Alice's page doesn't load; attackers on the internet flood the
  router the other way round; and the router protected by a per-device limit. Each case lists its side
  effects. The scene is `shared/conntrack-scene.js`; the composition itself is a 2.6 KB HTML file.
  Addresses are from the documentation ranges, timeouts are the Linux defaults.
- **Analogies** (`hyperframes/dist-demo/kitchen.html`, `cars.html`): the same four cases told as everyday
  stories, with the same layout so they can be compared with the router demo. Kitchen: the order rail at the
  pass is the table, every order is one ticket until the dish is served, a prankster guest orders dishes nobody
  eats, prank phone orders come in from outside. Cars: a Park & Ride is the table, every trip parks one car
  until the traveller is back, a prankster tows in junk cars, cars from other towns take the spaces from
  outside. An intro lists what stands for what; each caption has a second line saying what it means in the
  router. Scene: `shared/analogy-scene.js` (both themes share the simulation).

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
| `cb3-front.png` | Centro Business 3.0 front (LEDs, USB 3.0), [cb-guide.swisscom.ch](https://cb-guide.swisscom.ch/en/router/ports_led) |
| `tcl-ik41-front.jpeg` | TCL LinkKey IK41 front, [komsa.pl product page](https://www.komsa.pl/producenci/TCL/TCL-Router-przeno%C5%9Bny-IK41-czarny-IK41VE1-2ALCPL2/) |
| `tcl-ik41-edge.jpeg` | TCL LinkKey IK41 edge with the LTE antenna sockets, same page |

They belong to Swisscom and TCL/KOMSA and are not committed to this repo. The router panels are
also available as a clean vector redraw (`vector/`, committed, made from measured positions:
`node vector/build-panels.mjs` regenerates the SVGs and the lit-LED sprites), and so are the USB stick,
the 5G Receiver and its PoE adapter (redrawn after the guide's 5G Receiver installation pictures).

## Live config

Every demo page fetches its config at runtime (`config/router.json`, `config/config.json`) and has
an editor under the player. Editing the JSON file and reloading works on the production build
without rebuilding.

Router demo (`config/router.json`):

| Field | Effect |
|---|---|
| `ethernet` | `false` leaves out the Ethernet step |
| `port` | LAN port 1-5 for the Ethernet cable (`{port}` in `stepEthernet` is replaced) |
| `direct` | `false` leaves out plugging the stick straight into the router |
| `extension` | `false` leaves out the extension cable and the window |
| `usbPort` | `"front"` (USB 3.0) or `"back"` (USB 2.0); used by both USB steps (`{usb}` in the texts) |
| `modem` | `"stick"` (TCL IK41 USB stick, default) or `"receiver"` (5G Receiver on the outside of the window, flat cable to a PoE adapter, adapter powered from the wall socket, adapter to port 4 WAN) |
| `panelStyle` | `"vector"` (default: the clean redraws in `vector/`) or `"photo"` (the photos) for the router panels and the USB stick |
| `step*`, `done`, `cableLabel`, `title` | caption texts; `cableLabel` is shown along the extension cable |
| `cableColor`, `usbCableColor`, `ledColor`, `accentColor` | colours |
| `speed`, `loop` | playback speed, loop or play once |

Connection table demo (`config/conntrack.json`):

| Field | Effect |
|---|---|
| `normal`, `outbound`, `inbound`, `mitigation` | `false` leaves out that case (normal use, flood from the LAN, flood from the internet, protected) |
| `tableSize` | slots in the drawn table, 16-48 in steps of 8 |
| `perHostLimit` | connections per device allowed in the protected case |
| `site`, `title` | the site Alice opens, the title |
| `speed`, `loop` | playback speed, loop or play once |

Analogy demos (`config/kitchen.json`, `config/cars.json`): the same fields as the connection table demo;
`site` is Alice's dish / destination, `tableSize` 8-24 (rail clips / parking spaces), `perHostLimit` 2-8
(per table / per household).

The router animation's length follows the enabled steps (12.9 s with no extension, 24.7 s with everything).
