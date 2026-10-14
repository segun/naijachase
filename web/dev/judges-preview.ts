import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { AvatarPreset } from "../src/avatar/avatar-model.ts";
import {
  consequenceLines,
  offenceLabel,
  punishmentLabel,
  tally,
  type DisciplinaryCase
} from "../src/domain/pressure.ts";
import {
  announce,
  frameAt,
  planPanel,
  type PanelHandle,
  type PanelPlan,
  type Vote
} from "../src/scenes/panel/panel-scene.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

// UI Elements
const hudControls = $("hud-controls");
const toggleHudBtn = $<HTMLButtonElement>("toggle-hud");
const canvas = $<HTMLCanvasElement>("scene-canvas");
const fadeOverlay = $("fade-overlay");
const verdictCard = $("verdict-card");
const cardOffence = $("card-offence");
const cardDecision = $("card-decision");
const cardPunishment = $("card-punishment");
const cardConsequences = $("card-consequences");
const btnAcceptVerdict = $<HTMLButtonElement>("btn-accept-verdict");

// Controls
const btnPlay = $<HTMLButtonElement>("btn-play");
const btnRestart = $<HTMLButtonElement>("btn-restart");
const btnSkip = $<HTMLButtonElement>("btn-skip");
const timeSlider = $<HTMLInputElement>("time-slider");
const timeInput = $<HTMLInputElement>("time-input");
const timeDisplay = $("time-display");
const selectDetail = $<HTMLSelectElement>("select-detail");
const selectCamera = $<HTMLSelectElement>("select-camera");
const btnResetCam = $<HTMLButtonElement>("btn-reset-cam");
const selectPresetVotes = $<HTMLSelectElement>("select-preset-votes");
const tallyDisplay = $("tally-display");
const selectAvatar = $<HTMLSelectElement>("select-avatar");
const inputHour = $<HTMLInputElement>("input-hour");
const selectVerdictMode = $<HTMLSelectElement>("select-verdict-mode");
const selectOffence = $<HTMLSelectElement>("select-offence");
const selectPunishment = $<HTMLSelectElement>("select-punishment");
const modelStatusBadge = $("model-status-badge");

// HUD Status
const badgePhase = $("badge-phase");
const announcementText = $("announcement-text");
const cameraShotIndicator = $("camera-shot-indicator");

// 2D View Elements
const view2dWrapper = $("view-2d-wrapper");
const v2dSubtitle = $("v2d-subtitle");
const v2dDecisionHeading = $("v2d-decision-heading");
const v2dPunishmentDesc = $("v2d-punishment-desc");
const v2dConsequenceList = $("v2d-consequence-list");
const btnV2dSkip = $<HTMLButtonElement>("btn-v2d-skip");
const btnV2dAccept = $<HTMLButtonElement>("btn-v2d-accept");

// State
let votes: Vote[] = ["warning", "punish", "punish", "warning", "punish"];
let plan: PanelPlan = planPanel(votes);
let currentTime = 0;
let isPlaying = false;
let lastTickTime = performance.now();
let handle: (PanelHandle & { scene?: Scene }) | undefined;
let orbitCamera: ArcRotateCamera | undefined;
let controller: AbortController | undefined;
let generation = 0;

// Populate Avatar choices
for (let n = 1; n <= 10; n++) {
  const id = `avatar-${String(n).padStart(2, "0")}`;
  selectAvatar.add(new Option(`Avatar ${n} (${n % 2 === 1 ? "fem" : "masc"})`, id));
}

function getAvatarPreset(): AvatarPreset {
  const feminine = Number(selectAvatar.value.slice(-2)) % 2 === 1;
  return {
    avatar_id: selectAvatar.value,
    label: `Investigator ${selectAvatar.value}`,
    presentation: feminine ? "feminine" : "masculine",
    skin_tone: "medium brown",
    hair_style: feminine ? "short_locs" : "low_cut",
    skin_color: "#7d5138",
    hair_color: "#191411",
    uniform_primary: "#176b4d",
    uniform_secondary: "#f2ebd8",
    uniform_accent: "#e8b94d"
  };
}

function updateTallyUI() {
  const counts = tally(votes);
  const isPunish = counts.punish >= 3;
  tallyDisplay.textContent = `${counts.punish} Punish : ${counts.warning} Warning → Decision: ${isPunish ? "Punish" : "Warning"}`;
  tallyDisplay.className = `tally-pill verdict-${isPunish ? "punish" : "warning"}`;

  for (let i = 0; i < 5; i++) {
    const btn = $(`jbtn-${i}`);
    const v = votes[i];
    btn.textContent = `J${i + 1}: ${v.toUpperCase()}`;
    btn.className = `judge-btn vote-${v}`;
  }
}

function updateJudgeMeters(raised: number[]) {
  raised.forEach((val, i) => {
    const pct = Math.round(val * 100);
    const fill = $(`mfill-${i}`);
    const txt = $(`mtxt-${i}`);
    fill.style.width = `${pct}%`;
    fill.className = `meter-fill fill-${votes[i]}`;
    txt.textContent = `${pct}%`;
  });
}

function updateVerdictCard(isVerdictActive: boolean) {
  const mode = selectVerdictMode.value;
  const shouldShow = mode === "always" || (mode === "auto" && isVerdictActive);

  if (!shouldShow) {
    verdictCard.style.display = "none";
    return;
  }

  const counts = tally(votes);
  const decision: "punish" | "warning" = counts.punish >= 3 ? "punish" : "warning";
  const offence = selectOffence.value as DisciplinaryCase["offence"];
  const punishment = (decision === "punish" ? selectPunishment.value : "none") as DisciplinaryCase["punishment"];

  const caseData: DisciplinaryCase = {
    offence,
    votes,
    decision,
    punishment,
    points_before: 4200,
    points_after: punishment === "points_deducted" ? 3200 : 4200,
    old_rank: "Senior Investigator",
    new_rank: punishment === "demoted" ? "Investigator" : "Senior Investigator",
    repeat_offender: true,
    jailed_until: punishment === "jailed" ? new Date(Date.now() + 86400000).toISOString() : undefined
  };

  cardOffence.textContent = offenceLabel(offence);
  cardDecision.textContent = `${decision === "punish" ? "Punished" : "Released with a warning"} · ${counts.punish} to ${counts.warning}`;
  cardPunishment.textContent = `${punishmentLabel(punishment)}.`;

  const lines = consequenceLines(caseData);
  cardConsequences.innerHTML = lines.map(line => `<li>${line}</li>`).join("");

  btnAcceptVerdict.textContent =
    punishment === "jailed"
      ? "Accept judgement and leave"
      : "Accept judgement and return to the case";

  verdictCard.style.display = "grid";
}

function update2DView(t: number) {
  const frame = frameAt(plan, t);
  const counts = tally(votes);
  const decision = counts.punish >= 3 ? "punish" : "warning";
  const offence = selectOffence.value as DisciplinaryCase["offence"];
  const punishment = (decision === "punish" ? selectPunishment.value : "none") as DisciplinaryCase["punishment"];

  v2dSubtitle.textContent = `${offenceLabel(offence)} reported after pressing witness.`;

  for (let i = 1; i <= 5; i++) {
    const seatLi = $(`seat-${i}`);
    const voteTxt = $(`vote-txt-${i}`);
    const seatIndex = i - 1;
    const isRaised = frame.raised[seatIndex] > 0.05;
    const isDone = frame.raised[seatIndex] >= 0.99;
    const v = votes[seatIndex];

    seatLi.classList.add("seated");
    if (isDone) {
      seatLi.className = `seated ${v}`;
      voteTxt.textContent = v === "punish" ? "Punish" : "Warning";
    } else if (isRaised) {
      seatLi.className = "seated";
      voteTxt.textContent = "Voting…";
    } else {
      seatLi.className = "seated";
      voteTxt.textContent = "Deciding…";
    }
  }

  if (frame.verdict) {
    v2dDecisionHeading.textContent = `${decision === "punish" ? "Punished" : "Released with a warning"} · ${counts.punish} to ${counts.warning}`;
    v2dPunishmentDesc.textContent = `${punishmentLabel(punishment)}.`;
    const caseData: DisciplinaryCase = {
      offence,
      votes,
      decision,
      punishment,
      points_before: 4200,
      points_after: punishment === "points_deducted" ? 3200 : 4200,
      old_rank: "Senior Investigator",
      new_rank: punishment === "demoted" ? "Investigator" : "Senior Investigator",
      repeat_offender: true
    };
    v2dConsequenceList.innerHTML = consequenceLines(caseData).map(l => `<li>${l}</li>`).join("");
    btnV2dAccept.disabled = false;
    btnV2dSkip.style.display = "none";
  } else {
    v2dDecisionHeading.textContent = "The panel is deliberating…";
    v2dPunishmentDesc.textContent = "";
    v2dConsequenceList.innerHTML = "";
    btnV2dAccept.disabled = true;
    btnV2dSkip.style.display = "inline-block";
  }
}

function updateFrame(t: number) {
  currentTime = Math.max(0, Math.min(plan.end, t));
  const frame = frameAt(plan, currentTime);

  timeSlider.value = currentTime.toFixed(2);
  timeInput.value = currentTime.toFixed(2);
  timeDisplay.textContent = `${currentTime.toFixed(2)}s / ${plan.end.toFixed(2)}s`;

  // Fade
  fadeOverlay.style.opacity = String(1 - frame.fade);

  // Phase & Audio narration
  if (frame.verdict) {
    badgePhase.textContent = "Verdict Cut";
    badgePhase.style.color = "var(--gold, #e8b94d)";
    cameraShotIndicator.textContent =
      selectCamera.value === "orbit" ? "Camera: Free Orbit" : "Camera: Accept Judgement";
  } else if (currentTime < plan.raiseAt[0]!) {
    badgePhase.textContent = "Intro";
    badgePhase.style.color = "#9bb8ad";
    cameraShotIndicator.textContent =
      selectCamera.value === "orbit" ? "Camera: Free Orbit" : "Camera: Bench Wide";
  } else {
    const activeIndex = plan.raiseAt.findIndex((at, idx) => {
      const nextAt = plan.raiseAt[idx + 1] ?? plan.cutAt;
      return currentTime >= at && currentTime < nextAt;
    });
    badgePhase.textContent = activeIndex >= 0 ? `Judge ${activeIndex + 1} Voting` : "Voting";
    badgePhase.style.color = "#4ade80";
    cameraShotIndicator.textContent =
      selectCamera.value === "orbit" ? "Camera: Free Orbit" : "Camera: Bench Zooming";
  }

  // Announcement
  const latestVoteIndex = frame.revealed.findLastIndex(v => v !== null);
  if (latestVoteIndex >= 0) {
    announcementText.textContent = announce(latestVoteIndex, frame.revealed[latestVoteIndex]!);
  } else {
    announcementText.textContent = "The panel is convening…";
  }

  updateJudgeMeters(frame.raised);
  updateVerdictCard(frame.verdict);

  if (selectDetail.value === "2d") {
    update2DView(currentTime);
  } else if (handle) {
    handle.seek(currentTime);
  }
}

async function rebuildScene() {
  const token = ++generation;
  controller?.abort();
  handle?.dispose();
  handle = undefined;
  orbitCamera?.dispose();
  orbitCamera = undefined;

  controller = new AbortController();
  const signal = controller.signal;

  plan = planPanel(votes);
  timeSlider.max = String(plan.end.toFixed(2));

  const is2D = selectDetail.value === "2d";
  view2dWrapper.classList.toggle("active", is2D);
  canvas.style.display = is2D ? "none" : "block";

  if (is2D) {
    modelStatusBadge.textContent = "2D Presentation (Fallback)";
    updateFrame(currentTime);
    return;
  }

  modelStatusBadge.textContent = "Loading 3D scene…";

  try {
    const { createPanelScene3D } = await import("../src/scenes/panel/chase3d-panel.ts");
    const options = {
      preset: getAvatarPreset(),
      hour: Number(inputHour.value),
      quality: "high" as const,
      models: selectDetail.value === "full",
      votes,
      signal,
      onFrame: () => {
        // Driven synchronously via seek for deterministic scrubbing
      },
      onFault: (why: string) => {
        modelStatusBadge.textContent = `Fault: ${why}`;
      }
    };

    const nextHandle = await createPanelScene3D(canvas, options);
    if (token !== generation || signal.aborted) {
      nextHandle.dispose();
      return;
    }

    handle = nextHandle;

    // Check models diagnostic
    if (handle.scene) {
      const judges = [1, 2, 3, 4, 5].map(i => handle?.scene?.getMeshByName(`judge_${i}:__root__`));
      const loadedCount = judges.filter(Boolean).length;
      if (selectDetail.value === "full") {
        modelStatusBadge.textContent = `Judge models: ${loadedCount}/5 (unrigged) · Avatar model: fallback/wired`;
      } else {
        modelStatusBadge.textContent = "Standard Detail (procedural figures)";
      }
    } else {
      modelStatusBadge.textContent = "Scene ready";
    }

    // Configure Orbit camera if selected
    setupCameraMode();

    updateFrame(currentTime);
  } catch (err) {
    if (signal.aborted) return;
    console.error("Failed to build panel scene:", err);
    modelStatusBadge.textContent = `Error: ${err}`;
  }
}

function setupCameraMode() {
  if (!handle?.scene) return;
  const isOrbit = selectCamera.value === "orbit";

  if (isOrbit) {
    if (!orbitCamera) {
      orbitCamera = new ArcRotateCamera(
        "previewOrbit",
        -Math.PI / 2,
        Math.PI / 2.3,
        7.5,
        new Vector3(0, 1.2, 3.5),
        handle.scene
      );
      orbitCamera.lowerRadiusLimit = 1;
      orbitCamera.upperRadiusLimit = 25;
      orbitCamera.wheelDeltaPercentage = 0.02;
    }
    handle.scene.activeCamera = orbitCamera;
    orbitCamera.attachControl(canvas, true);
  } else {
    if (orbitCamera) {
      orbitCamera.detachControl();
    }
    const sceneCam = handle.scene.getCameraByName("camera");
    if (sceneCam) {
      handle.scene.activeCamera = sceneCam;
    }
  }
}

function tick(now: number) {
  if (isPlaying) {
    const delta = (now - lastTickTime) / 1000;
    currentTime += delta;
    if (currentTime >= plan.end) {
      currentTime = plan.end;
      setPlayState(false);
    }
    updateFrame(currentTime);
  }
  lastTickTime = now;
  requestAnimationFrame(tick);
}

function setPlayState(playing: boolean) {
  isPlaying = playing;
  btnPlay.textContent = isPlaying ? "⏸ Pause" : "▶ Play";
  btnPlay.classList.toggle("primary", !isPlaying);
  btnPlay.classList.toggle("active-toggle", isPlaying);
  lastTickTime = performance.now();
}

// Event Listeners
btnPlay.onclick = () => {
  if (currentTime >= plan.end) currentTime = 0;
  setPlayState(!isPlaying);
};

btnRestart.onclick = () => {
  currentTime = 0;
  updateFrame(0);
  setPlayState(true);
};

btnSkip.onclick = () => {
  currentTime = plan.cutAt + 0.1;
  updateFrame(currentTime);
  setPlayState(false);
};

timeSlider.oninput = () => {
  setPlayState(false);
  updateFrame(Number(timeSlider.value));
};

timeInput.onchange = () => {
  setPlayState(false);
  updateFrame(Number(timeInput.value));
};

selectDetail.onchange = () => {
  void rebuildScene();
};

selectCamera.onchange = () => {
  setupCameraMode();
  updateFrame(currentTime);
};

btnResetCam.onclick = () => {
  if (orbitCamera) {
    orbitCamera.alpha = -Math.PI / 2;
    orbitCamera.beta = Math.PI / 2.3;
    orbitCamera.radius = 7.5;
    orbitCamera.target = new Vector3(0, 1.2, 3.5);
    updateFrame(currentTime);
  }
};

selectAvatar.onchange = () => {
  void rebuildScene();
};

inputHour.onchange = () => {
  void rebuildScene();
};

selectVerdictMode.onchange = () => {
  const frame = frameAt(plan, currentTime);
  updateVerdictCard(frame.verdict);
};

selectOffence.onchange = () => {
  const frame = frameAt(plan, currentTime);
  updateVerdictCard(frame.verdict);
  if (selectDetail.value === "2d") update2DView(currentTime);
};

selectPunishment.onchange = () => {
  const frame = frameAt(plan, currentTime);
  updateVerdictCard(frame.verdict);
  if (selectDetail.value === "2d") update2DView(currentTime);
};

// Preset votes handler
selectPresetVotes.onchange = () => {
  switch (selectPresetVotes.value) {
    case "default":
      votes = ["warning", "punish", "punish", "warning", "punish"];
      break;
    case "all-punish":
      votes = ["punish", "punish", "punish", "punish", "punish"];
      break;
    case "all-warning":
      votes = ["warning", "warning", "warning", "warning", "warning"];
      break;
    case "majority-warning":
      votes = ["punish", "warning", "warning", "punish", "warning"];
      break;
    case "alternate":
      votes = ["punish", "warning", "punish", "warning", "punish"];
      break;
  }
  updateTallyUI();
  void rebuildScene();
};

// Individual Judge vote toggle buttons
for (let i = 0; i < 5; i++) {
  const btn = $(`jbtn-${i}`);
  btn.onclick = () => {
    votes[i] = votes[i] === "punish" ? "warning" : "punish";
    selectPresetVotes.value = "custom";
    updateTallyUI();
    void rebuildScene();
  };
}

// Verdict Card Accept button
btnAcceptVerdict.onclick = () => {
  alert("Judgement accepted! In the actual game, this returns to the Case Desk or exits if jailed.");
  currentTime = 0;
  updateFrame(0);
};

btnV2dSkip.onclick = () => {
  currentTime = plan.cutAt + 0.1;
  updateFrame(currentTime);
};

btnV2dAccept.onclick = () => {
  alert("Judgement accepted (2D)! Returning to Case Desk.");
  currentTime = 0;
  updateFrame(0);
};

toggleHudBtn.onclick = () => {
  const isCollapsed = hudControls.classList.toggle("collapsed");
  toggleHudBtn.textContent = isCollapsed ? "Show controls" : "Collapse controls";
};

// Teardown
window.addEventListener("pagehide", () => {
  controller?.abort();
  handle?.dispose();
  orbitCamera?.dispose();
});

// Initial boot
updateTallyUI();
void rebuildScene();
requestAnimationFrame(tick);
