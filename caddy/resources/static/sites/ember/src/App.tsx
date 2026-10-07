import { For } from "solid-js";

interface Project {
	name: string;
	year: string;
	description: string;
	stack: string;
}

const projects: Project[] = [
	{
		name: "ashfall",
		year: "2025",
		description: "async io runtime on io_uring.",
		stack: "rust, io_uring, epoll, linux, lock-free",
	},
	{
		name: "lattice",
		year: "2025",
		description: "x86-64 compiler backend.",
		stack: "c++20, llvm, x86-64, risc-v, codegen",
	},
	{
		name: "slab",
		year: "2024",
		description: "malloc replacement for server workloads.",
		stack: "c, mmap, pthreads, posix, perf",
	},
	{
		name: "crashplate",
		year: "2023",
		description: "prototype runtime mod loader and hooking framework for native game binaries.",
		stack: "c++20, x86-64, inline hooks, sigscan, win/linux",
	},
];

const contact = ["discord: burningcoals_", "tg: <hidden>", "email: <hidden>"];

export default function App() {
	return (
		<div class="page">
			<main>
				<section class="hero">
					<h1>ember_</h1>
					<p class="lede">
						she/they<span class="slash">//</span>game modding/systems dev<span class="slash">//</span>rust +
						c++.
					</p>
				</section>

				<section class="section">
					<h2>
						<span class="slash">//</span> work
					</h2>
					<ul class="projects">
						<For each={projects}>
							{(p) => (
								<li class="project">
									<div class="project-head">
										<span class="project-name">{p.name}</span>
										<span class="project-year">{p.year}</span>
									</div>
									<p class="project-desc">{p.description}</p>
									<p class="project-stack">{p.stack}</p>
								</li>
							)}
						</For>
					</ul>
				</section>

				<section class="section">
					<h2>
						<span class="slash">//</span> contact
					</h2>
					<ul class="contact">
						<For each={contact}>
							{(c) => (
								<li>
									<span>{c}</span>
								</li>
							)}
						</For>
					</ul>
					<span class="muted">due to spam, some contacts are hidden at the moment. sorry!</span>
				</section>
			</main>

			<footer class="footer">
				<span>© {new Date().getFullYear()} ember</span>
				<span class="muted">built with solidjs</span>
			</footer>
		</div>
	);
}
