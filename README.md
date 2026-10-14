# Flight Sim

A 3D flight simulator that runs in the browser, built with Next.js, Three.js and the Web Audio API.
Pick an aircraft, choose a mission and fly: free flight, a ring course against the clock, or a
landing trial. MIT licensed.

Part of [splatverse](https://github.com/splatverse), a collection of open-source 3D projects for the browser.
Siblings: [Arcade 3D](https://github.com/splatverse/arcade-3d) (five browser 3D games),
[Live 3D Cricket](https://github.com/splatverse/live-3d-cricket) (commentary feeds as 3D cricket) and
[Splat Studio](https://github.com/splatverse/splat-studio) (video to 3D Gaussian splats).

## Features

- **Three aircraft** with their own flight model (weight, thrust, drag, lift, roll/pitch/yaw rates):
  an aerobatic biplane, a twin-jet strike fighter and a narrow-body airliner.
- **Three missions**: Free Flight, Ring Challenge (fly through glowing rings to extend your time)
  and Landing Trial (line up, slow down and touch down without crashing).
- **Three skies**: golden sunset, synthwave neon grid and ocean daylight.
- **Live HUD** with airspeed, altitude, heading, throttle, stall warning, rings and time.
- **Engine sound** synthesised with the Web Audio API.
- **3D hangar preview** of the selected aircraft.
- **Custom liveries**: upload a PNG, JPG or WebP and it wraps the aircraft, plus a screenshot gallery.
- **Pilot accounts and a leaderboard** in MongoDB, or in the browser's localStorage when no
  database is configured (Local Mode).

All aircraft, terrain and effects are procedural Three.js geometry. The repository contains no
downloaded models, textures or sound files.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no environment set, the app runs in
Local Mode and saves uploads to `public/uploads`.

Controls: Shift / Ctrl for throttle, W/S or the up/down arrows for pitch, A/D or left/right for
roll, Q/E for yaw. The Flight Guide tab in the app has takeoff and landing tips.

## Configuration

Copy [`.env.example`](.env.example) to `.env.local` and fill in what you need:

- `MONGODB_URI` (optional): accounts and the global leaderboard. The app uses the
  `flight_simulator` database.
- `STORAGE_*` (optional in development, needed for uploads in production): any S3-compatible
  bucket. It must allow public reads and CORS `GET` from your site, so the 3D view can load a
  livery as a texture.

Local Mode keeps pilot accounts in the browser only, with the password in plain text in
localStorage: it is meant for trying the app, not for real accounts. Configure MongoDB for
anything public.

## Production build

```bash
npm run build
npm start
```

`next.config.ts` uses `output: "standalone"`, so the included `Dockerfile` builds a small image
that runs `node server.js` on port 3000.

## Run Flight Sim on Harakumo

Flight Sim is open source (MIT) and listed on [Nucleus](https://nucleus.harakumo.com/-/explore),
Harakumo's code home. It is a Next.js Node server (API routes for accounts, the leaderboard and
uploads), so on Harakumo it runs as a **server app (Pro plan and up)**, not a static site.

1. **Create a project** at [harakumo.com/dashboard](https://harakumo.com/dashboard) → Projects → New project.
2. **Create an API key** under Settings → API keys.
3. **Add the environment** (Project → Environment) from `.env.example`: `MONGODB_URI` for a shared
   leaderboard (MongoDB is required for that today), and the `STORAGE_*` values if players should
   upload liveries. A server app's disk is not kept between deploys, so uploads need a bucket.
4. **Deploy** from a folder with the CLI, or ask your AI assistant with the Harakumo connector:

   ```bash
   npm i -g @harakumo/cli
   harakumo login --key <your API key>
   harakumo deploy <project id> .
   ```

   Every deploy is saved as a commit in the project's private Nucleus repo.

Notes:

- **Uploads** accept PNG, JPG and WebP up to 5 MB and are rate limited per IP (10 per 10 minutes,
  in the server's memory).
- **Your MongoDB must accept the server's connections**: allow its address range, and use a
  database user limited to this database.

## Project layout

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Hangar, mission picker, leaderboard, media and flight guide tabs |
| `src/app/components/FlightSimulator.tsx` | The 3D world, flight physics, missions and audio |
| `src/app/components/HUD.tsx` | Heads-up display |
| `src/app/components/AircraftSelection.tsx` | Aircraft presets and their flight parameters |
| `src/app/api/flight-logs` | Leaderboard (MongoDB or Local Mode) |
| `src/app/api/auth` | Sign up and log in |
| `src/app/api/upload` + `src/lib/storage.ts` | Livery and screenshot uploads to an S3-compatible bucket |

## License

[MIT](LICENSE) © 2026 Charan Raj Kandula
