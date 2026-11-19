const REFRESH_MS = 30000;
const STALE_MS = 300000;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const bytes = (value) => {
  if (value === null || value === undefined) return "-";
  const units = ["b", "kb", "mb", "gb", "tb"];
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${i === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)}${units[i]}`;
};

const uptime = (seconds) => {
  if (seconds === null || seconds === undefined) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
};

const ago = (timestamp) => {
  const seconds = Math.max(0, Math.round((Date.now() / 1000) - timestamp));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
};

async function get(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} -> ${response.status}`);
  return response.json();
}

function statRow(label, value, barPercent) {
  const row = el("div");
  row.appendChild(el("dt", undefined, label));
  const dd = el("dd", undefined, value);
  if (barPercent !== null && barPercent !== undefined) {
    const bar = el("span", "bar");
    const fill = el("span", barPercent > 85 ? "hot" : undefined);
    fill.style.width = `${Math.max(2, Math.round(barPercent))}%`;
    bar.appendChild(fill);
    dd.appendChild(bar);
  }
  row.appendChild(dd);
  return row;
}

function renderHosts(hosts) {
  const section = document.getElementById("hosts");
  section.textContent = "";

  for (const host of hosts) {
    const card = el("div", "host");
    const head = el("div", "host-head");
    head.appendChild(el("span", `m ${host.state}`));
    head.appendChild(el("span", "name", ` ${host.host}`));
    card.appendChild(head);

    const stats = el("dl", "stats");

    if (host.state === "down") {
      stats.appendChild(statRow("error", host.error || "unreachable", null));
      card.appendChild(stats);
      section.appendChild(card);
      continue;
    }

    const load = host.load1 === null ? "-" : host.load1.toFixed(2);
    stats.appendChild(statRow("load", host.cores ? `${load} / ${host.cores}c` : load, null));

    if (host.mem_total && host.mem_used !== null) {
      const percent = (host.mem_used / host.mem_total) * 100;
      stats.appendChild(statRow("mem", `${percent.toFixed(0)}% of ${bytes(host.mem_total)}`, percent));
    }

    if (host.disks && host.disks.length) {
      const disk = host.disks[0];
      const used = ((disk.size - disk.free) / disk.size) * 100;
      stats.appendChild(statRow(disk.mount, `${bytes(disk.free)} free of ${bytes(disk.size)}`, used));
    }

    stats.appendChild(statRow("up", uptime(host.uptime), null));
    card.appendChild(stats);
    section.appendChild(card);
  }
}

function renderSummary(status) {
  const summary = document.getElementById("summary");
  summary.textContent = "";

  const counts = status.counts || {};
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

  for (const state of ["up", "odd", "degraded", "down"]) {
    if (!counts[state]) continue;
    const part = el("span", state, `${counts[state]} ${state}`);
    summary.appendChild(part);
    summary.appendChild(document.createTextNode(" "));
  }

  summary.appendChild(el("span", "dim", `${total} services`));

  const stamp = document.getElementById("stamp");
  stamp.textContent = `probe ${ago(status.generated_at)} · ${status.elapsed_ms}ms`;
  if (Date.now() / 1000 - status.generated_at > STALE_MS / 1000) {
    stamp.textContent += " (stale)";
    stamp.classList.add("down");
  } else {
    stamp.classList.remove("down");
  }
}

function renderGroups(services, query) {
  const main = document.getElementById("groups");
  main.textContent = "";

  const groups = [];
  for (const service of services) {
    const group = groups.find((g) => g.name === service.group);
    if (group) group.services.push(service);
    else groups.push({ name: service.group, services: [service] });
  }

  const needle = query.trim().toLowerCase();

  for (const group of groups) {
    const section = el("section", "group");
    const heading = el("h2", undefined, group.name);
    const grid = el("div", "grid");

    let visible = 0;
    for (const service of group.services) {
      const haystack = `${service.name} ${service.host} ${group.name} ${service.note || ""}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      visible += 1;

      const card = el("a", `card ${service.state}`);
      card.appendChild(el("span", `m ${service.state}`));

      const name = el("span", "name", ` ${service.name}`);
      card.appendChild(name);

      const metaParts = [service.host || "-"];
      if (service.ms !== undefined) metaParts.push(`${service.ms}ms`);
      if (service.code) metaParts.push(String(service.code));
      const meta = el("div", "meta", metaParts.join(" · "));
      card.appendChild(meta);

      if (service.url) {
        card.href = service.url;
        card.title = service.url;
      } else {
        card.classList.add("lan");
      }

      grid.appendChild(card);
    }

    if (!visible) section.classList.add("empty");
    section.appendChild(heading);
    section.appendChild(grid);
    main.appendChild(section);
  }
}

let cache = null;

async function render() {
  const status = await get("status.json");
  cache = status;
  renderSummary(status);
  renderHosts(status.hosts);
  renderGroups(status.services, document.getElementById("filter").value);
}

const filter = document.getElementById("filter");

filter.addEventListener("input", () => {
  if (cache) renderGroups(cache.services, filter.value);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== filter) {
    event.preventDefault();
    filter.focus();
  }
});

render().catch((error) => {
  document.getElementById("summary").textContent = `status.json not written yet - ${error.message}`;
});

setInterval(() => render().catch(() => {}), REFRESH_MS);
