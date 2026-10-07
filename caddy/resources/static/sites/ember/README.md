# ember

barebones dev portfolio for **ember** (`burningcoals_`) — systems developer
working in rust and c++.

black background, monospace, no borders, no rounded corners, all lowercase.

## stack

- [solidjs](https://www.solidjs.com/) + typescript
- [vite](https://vite.dev/) for dev/build

## dev

```sh
npm install
npm run dev      # http://localhost:5173
npm run preview  # serve the build
```

to rebuild the committed `dist` in place — installs, builds, then removes
`node_modules` again so the repo stays clean:

```sh
./build.sh
```

## editing content

all page copy lives in `src/App.tsx` — the `projects` and `contact` arrays
plus the hero prose. everything renders lowercase via `text-transform` on
`body`.

there are currently no clickable links — nav labels and contact handles are
plain text (`for now`).

a fire particle background was prototyped early on and removed. the original
project git history (including that commit) is preserved as a bundle outside
this repo.
