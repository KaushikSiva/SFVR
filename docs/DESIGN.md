# SFVR

Visual thesis: a warm, recognizable Alamo Square fills the screen; precise ivory type and signal-orange accents make a compact arcade shooter feel like a finished game.

Content plan: full-canvas SF environment and one start action; a minimal score/time/shield HUD during play; a concise results screen with accuracy, best score and replay; an accessible controls sheet and XR entry.

Interaction thesis: a short title-to-arena transition, responsive shot/recoil and hit particles, and a clear combo/round-result reveal. Use explicit point-and-release teleporting, viewer-relative stick movement and discrete snap turns; reduce decorative motion when requested.

Game: 60-second drone-defense rounds in a bounded park arena. Mouse/touch aim and fire on desktop/mobile. WebXR joint tracking detects extended index and middle fingers with the remaining fingers curled, firing while held. Native pinch input also fires while held. Navigation and menu selections take priority over firing. The earlier index-curl trigger remains available for single shots. Controllers retain trigger firing. Three shield charges, rechargeable magazine and increasing spawn pressure. No artificial camera shake in XR.

The environment reuses the user's CORTEX authored Painted Ladies and DataSF context, with a new simplified park and arcade gameplay. It is an artistic approximation. The original CORTEX app remains independently runnable.

This first game does not yet integrate ExecuTorch. Do not present ordinary raycasting or scripted drone behavior as model inference. Both hands and scored shots have been observed on a physical Galaxy XR. Sustained performance and comfort still need broader testing.

Visual upgrade: photographed HDR sky and environment lighting; cached static shadows in stereo; physical roughness/normal maps; full-volume planters, grasses, lamps and fences; chamfered blasters and quadrotor drones. Prominent Samsung Galaxy XR identification, with immersive entry as the primary action on supported headsets.

Locomotion: show one destination ring and reuse the existing XR HUD for instructions and a Home action. Preserve head tracking and eye height, fade briefly on teleport/turn, and keep virtual travel inside a flat park region with body clearance around props.
