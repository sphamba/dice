# Dice

A dice simulator that runs in the browser on phone and desktop. It renders the dice with WebGL2 and simulates them with a small custom physics engine. There is no framework and no runtime dependency.

## Commands

```sh
npm ci        # install the toolchain
npm run dev   # dev server with live reload
npm test      # unit tests (Vitest)
npm run build # static build into dist/
```

The dev server uses https with a self-signed certificate. To test on a phone, run `npm run dev -- --host`, open the https LAN URL and accept the certificate warning once.

## Directory layout

- `src/math/` - vectors, matrices, quaternions.
- `src/physics/` - rigid bodies, the symplectic Euler integrator, the world and its box, collision detection, the impulse solver.
- `src/dice/` - polyhedron shapes and face labels.
- `src/render/` - the WebGL2 renderer.
- `src/input/` - pointer fling and device motion.
- `src/ui/` - the dice set panel.
- `src/audio/` - synthesized sound and haptics.

## Deployment

The site is published to GitHub Pages by `.github/workflows/pages.yml` on every push to `main`. Set the Pages source to "GitHub Actions" in the repository settings.
