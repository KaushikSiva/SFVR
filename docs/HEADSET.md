# Samsung Galaxy XR setup

## Public demo

Open **https://kaushiksiva.github.io/SFVR/** in Chrome on Samsung Galaxy XR.
Select **Enter Galaxy XR**, accept tracking permissions, then point and pinch.
The HTTPS demo needs no USB cable or running laptop server.

## Local development

Use Node.js 22.12+ and Android SDK Platform Tools (`adb`). Connect the Galaxy XR
by USB, enable developer options and USB debugging, and approve the computer
inside the headset. Then run:

```sh
npm ci
npm run play:xr
```

The command starts the local game and opens `http://localhost:5186` on the
headset. Keep the port number: plain `localhost` addresses a different port.
On your laptop the game is at `http://127.0.0.1:5186`.

The watcher restores ADB reverse forwarding after USB reconnection. Keep the
terminal open and the laptop awake. If you prefer separate processes:

```sh
npm run dev
# Another terminal:
npm run headset
npm run headset:watch
```

`adb devices -l` must show `device`, not `unauthorized`. If unauthorized, accept
**Allow USB debugging** in the headset. If localhost is offline, reconnect the
USB cable and rerun `npm run headset`. A plain HTTP LAN URL normally cannot start
immersive WebXR; use the HTTPS demo or headset-local localhost over ADB reverse.

With several Android devices attached, set `ANDROID_SERIAL` to the Galaxy XR
serial. The automatic reconnection watcher targets Samsung model SM-I610.

## Controls

- **Hands:** point the ray, pinch to start/fire/replay, hold for repeat fire.
- **Controllers:** aim and use the standard trigger/select action.
- **Laptop:** mouse and click, A/D or arrows to strafe, R reload, Escape pause.
- **Phone:** tap drones; tap the ammo counter to reload.

The pale aiming ring confirms that a ray intersects a drone. Empty magazines
reload automatically. Use the headset's system controls to exit immersive mode;
the game pauses on exit or when the XR session loses visibility.

## Validation

The real SM-I610 has loaded the game, entered immersive mode, exposed both
tracked hands, and registered successful shots. The generic IWER test rig is
only for WebXR API/input regression checks, not Samsung hardware emulation.

Official platform documentation: [Android XR for WebXR](https://developer.android.com/develop/xr/web).
