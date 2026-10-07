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
npm run build    # -> dist/
npm run preview  # serve the build
```

## editing content

all page copy lives in `src/App.tsx` — the `projects` and `contact` arrays
plus the hero prose. everything renders lowercase via `text-transform` on
`body`.

there are currently no clickable links — nav labels and contact handles are
plain text (`for now`).

a fire particle background was prototyped in an earlier commit
(`git show 20419f0:src/components/FireCanvas.tsx`) and removed for now.
