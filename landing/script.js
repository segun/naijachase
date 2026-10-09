(() => {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const el = (name, attrs = {}, parent) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };

  /* ---------- Hero map: a stylised outline, not a survey-accurate border ---------- */
  const W = 600, H = 500;
  const proj = ([lon, lat]) => [20 + ((lon - 2.5) / 12.5) * (W - 40), 20 + ((14.4 - lat) / 10.4) * (H - 40)];
  const outline = [[2.7, 6.4], [2.8, 9.8], [3.6, 11.8], [4.2, 13.0], [5.5, 13.8], [7, 13.1], [9, 13.7], [11, 13.4], [13.5, 13.8], [14.6, 12.5], [13.9, 11.0], [12.5, 8.2], [11.5, 6.8], [9.7, 6.2], [8.6, 4.6], [7.2, 4.3], [5.5, 4.3], [4.6, 5.8], [3.4, 6.2]];
  const stops = [
    { name: "Lagos", at: [3.4, 6.5], clue: "He paid for his ride in crisp new notes and kept asking when the ferry leaves.", who: "Boatman" },
    { name: "Enugu", at: [7.5, 6.45], clue: "She bought a bag of ukwa and asked the way to the old coal mines.", who: "Market woman" },
    { name: "Abuja", at: [7.5, 9.1], clue: "He kept staring at the great rock on the horizon, then took the northbound bus.", who: "Conductor" },
    { name: "Kano", at: [8.5, 12.0], clue: "He asked about the dye pits and bought a heavy bag of groundnuts.", who: "Trader" },
    { name: "Maiduguri", at: [13.15, 11.8], clue: "Case closed. The thief was caught at the hideout, an hour before the deadline.", who: "Inspector" },
  ];
  const svg = document.getElementById("map");
  const bubble = document.getElementById("bubble");
  const bubbleText = document.getElementById("bubble-text");

  if (svg) {
    const grid = el("g", { class: "map-grid" }, svg);
    for (let x = 30; x < W; x += 30) for (let y = 30; y < H; y += 30) el("circle", { cx: x, cy: y, r: 1.4 }, grid);
    el("polygon", { class: "map-outline", points: outline.map((p) => proj(p).join(",")).join(" ") }, svg);

    const pts = stops.map((s) => proj(s.at));
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    el("path", { class: "route-base", d }, svg);
    const live = el("path", { class: "route-live", d }, svg);
    const total = live.getTotalLength();
    live.style.strokeDasharray = total;

    const nodes = stops.map((s, i) => {
      const g = el("g", { class: "stop" }, svg);
      el("circle", { cx: pts[i][0], cy: pts[i][1], r: 9 }, g);
      const right = pts[i][0] > W - 110;
      el("text", { x: pts[i][0] + (right ? -16 : 16), y: pts[i][1] + 5, "text-anchor": right ? "end" : "start" }, g).textContent = s.name;
      return g;
    });

    const pin = el("g", { class: "pin" }, svg);
    const ring = el("circle", { class: "pulse-ring", r: 14, fill: "none", stroke: "#f2c14e", "stroke-width": 2 }, pin);
    el("path", { d: "M0 0S13-12 13-22a13 13 0 1 0-26 0C-13-12 0 0 0 0Z", fill: "#f2c14e", stroke: "#f6f1e1", "stroke-width": 2 }, pin);
    el("circle", { cy: -22, r: 5, fill: "#0c2920" }, pin);
    ring.setAttribute("cy", 0);

    const segLen = [0];
    for (let i = 1; i < pts.length; i++) segLen.push(segLen[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const place = (len) => {
      const p = live.getPointAtLength(len);
      pin.setAttribute("transform", `translate(${p.x} ${p.y})`);
    };
    const say = (s) => {
      bubble.classList.remove("swap");
      void bubble.offsetWidth;
      bubble.querySelector(".who").textContent = s.who + " says…";
      bubble.querySelector(".emoji").textContent = s.who === "Inspector" ? "🚨" : "🕵🏾";
      bubbleText.textContent = "“" + s.clue + "”";
      bubble.classList.add("swap");
    };
    const reveal = (i) => nodes[i].classList.add("hit");

    if (reduce) {
      live.style.strokeDashoffset = 0;
      nodes.forEach((_, i) => reveal(i));
      place(total);
      say(stops[stops.length - 1]);
    } else {
      const travel = 1700, pause = 2600;
      const run = () => {
        nodes.forEach((n) => n.classList.remove("hit"));
        live.style.strokeDashoffset = total;
        place(0);
        reveal(0);
        say(stops[0]);
        let i = 0;
        const next = () => {
          if (i >= stops.length - 1) return setTimeout(run, pause + 1500);
          const from = segLen[i], to = segLen[i + 1], t0 = performance.now();
          const step = (now) => {
            const k = Math.min(1, (now - t0) / travel);
            const e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            const len = from + (to - from) * e;
            live.style.strokeDashoffset = total - len;
            place(len);
            if (k < 1) return requestAnimationFrame(step);
            i++;
            reveal(i);
            say(stops[i]);
            setTimeout(next, pause);
          };
          requestAnimationFrame(step);
        };
        setTimeout(next, pause);
      };
      run();
    }
  }

  /* ---------- Clue narrowing demo ---------- */
  const states = ["Kano", "Kebbi", "Sokoto", "Oyo", "Lagos", "Rivers", "Ogun", "Bayelsa"];
  const clues = [
    { text: "“Nobody here has ever seen the sea.”", keep: ["Kano", "Kebbi", "Sokoto", "Oyo"] },
    { text: "“It’s cattle and millet country. Dry as bone in harmattan.”", keep: ["Kano", "Kebbi", "Sokoto"] },
    { text: "“Every year, thousands wade into the river with nets to fish.”", keep: ["Kebbi"] },
  ];
  const chips = document.getElementById("chips");
  const btns = document.getElementById("clue-btns");
  const status = document.getElementById("demo-status");
  const resetBtn = document.getElementById("demo-reset");
  if (chips && btns) {
    let step = 0;
    const draw = () => {
      chips.replaceChildren(...states.map((s) => Object.assign(document.createElement("span"), { className: "chip", textContent: s, id: "chip-" + s })));
      btns.replaceChildren(...clues.map((c, i) => {
        const b = Object.assign(document.createElement("button"), { type: "button", className: "clue-btn", textContent: `Clue ${i + 1}: ${c.text}` });
        b.disabled = i !== 0;
        b.addEventListener("click", () => apply(i));
        return b;
      }));
      step = 0;
      resetBtn.hidden = true;
      status.textContent = "Tap clue 1 to start narrowing down.";
    };
    const apply = (i) => {
      if (i !== step) return;
      const keep = clues[i].keep;
      for (const s of states) document.getElementById("chip-" + s).classList.toggle("out", !keep.includes(s));
      btns.children[i].disabled = true;
      step++;
      if (btns.children[step]) {
        btns.children[step].disabled = false;
        status.textContent = `${keep.length} states left. Tap clue ${step + 1}.`;
      } else {
        document.getElementById("chip-" + keep[0]).classList.add("win");
        status.textContent = `Only ${keep[0]} fits all three clues. Time to travel.`;
        resetBtn.hidden = false;
      }
    };
    resetBtn.addEventListener("click", draw);
    draw();
  }

  /* ---------- Scroll reveal and counters ---------- */
  const count = (n) => {
    const target = +n.dataset.count;
    if (reduce) { n.textContent = target.toLocaleString("en"); return; }
    const t0 = performance.now(), dur = 1400;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      n.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString("en");
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      e.target.querySelectorAll("[data-count]").forEach(count);
      io.unobserve(e.target);
    }
  }, { threshold: .15 }) : null;
  document.querySelectorAll(".reveal").forEach((n) => {
    if (io) io.observe(n);
    else { n.classList.add("in"); n.querySelectorAll("[data-count]").forEach(count); }
  });
})();
