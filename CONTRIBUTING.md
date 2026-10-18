# Contributing to SFVR

Start with `npm ci` and `npm run dev`. Run `npm test` and `npm run build` before
opening a pull request. Browser tests require Google Chrome and the dev server;
`npm run test:xr` uses a generic WebXR input simulator.

Useful contributions include better sustained Galaxy XR frame pacing,
accessible input options, and new drone patterns. Keep hand input functional
without a controller, preserve the stationary XR camera, and avoid expensive
per-frame scene passes on the headset. Record the device and firmware when
reporting a hardware problem. Emulator results must be labeled as emulated.

Describe the problem, show the change with a screenshot or short clip, and
include relevant validation. Keep secrets and personal device identifiers out
of issues and pull requests. Preserve asset credits and source licenses.
