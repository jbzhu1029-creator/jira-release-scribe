#!/usr/bin/env python3
"""Build speech, captions, and scene pauses for the offline demo video.

`prepare` reads demo/narration.md and writes demo/work/plan.json.
`assemble` places that speech on the recorded scene times and writes the SRT.
"""

from __future__ import annotations

import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "demo" / "work"
NARRATION = ROOT / "demo" / "narration.md"
SRT_PATH = ROOT / "demo" / "release-scribe-demo.srt"

LEAD = 0.40
TAIL = 0.55
CUE_GAP = 0.12
END_PAD = 0.35
# Reading time so a dense screen stays up after the sentence ends.
# Index 0 is the opening. Indexes 1-9 are the npm run demo scenes.
MIN_HOLD = [0.0, 15.5, 13.0, 16.0, 15.0, 15.0, 13.0, 15.0, 14.0, 14.5]
CONTENT_LIMIT = 172.0

HEADING = re.compile(r"^## (Opening|Scene \d+ of \d+) - (.+)$", re.M)


def run(cmd: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, **kwargs)  # type: ignore[arg-type]


def wav_duration(path: Path) -> float:
    result = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            str(path),
        ],
        capture_output=True,
    )
    return float(result.stdout.strip())


def split_sentences(text: str) -> list[str]:
    protected = re.sub(r"(\d)\.(\d)", r"\1<dot>\2", text.strip())
    parts = re.split(r"(?<=[.!?])\s+", protected)
    sentences = []
    for part in parts:
        cleaned = part.replace("<dot>", ".").strip()
        if cleaned:
            sentences.append(cleaned)
    return sentences


def speakable(text: str) -> str:
    spoken = text.replace("A T L A S", "A. T. L. A. S.")
    spoken = spoken.replace("9 November 2026", "the ninth of November 2026")
    spoken = re.sub(r"\b1\.3\.1\b", "one point three point one", spoken)
    spoken = re.sub(r"\b1\.3\.0\b", "one point three point zero", spoken)
    spoken = re.sub(r"\b1\.4\.0\b", "one point four point zero", spoken)
    return spoken


def parse_sections(text: str) -> list[dict[str, str]]:
    matches = list(HEADING.finditer(text))
    if not matches:
        raise SystemExit(f"No Voice sections found in {NARRATION}.")
    sections: list[dict[str, str]] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        body = text[match.end() : end]
        voice = re.search(r"^Voice:\n\n(.+?)(?:\n\n|\Z)", body, re.S | re.M)
        if not voice:
            raise SystemExit(f"Missing Voice paragraph under {match.group(0)}")
        paragraph = " ".join(voice.group(1).strip().split())
        title = re.sub(r"\s+\([^)]*\)\s*$", "", match.group(2)).strip()
        sections.append({"kind": match.group(1), "title": title, "voice": paragraph})
    if sections[0]["kind"] != "Opening" or len(sections) != 10:
        raise SystemExit("Narration must start with one Opening and then nine scenes.")
    return sections


def synthesize(text: str, dest: Path) -> None:
    engine = os.environ.get("TTS_ENGINE", "piper")
    dest.parent.mkdir(parents=True, exist_ok=True)
    if engine == "piper":
        piper = os.environ["PIPER_BIN"]
        model = os.environ["PIPER_MODEL"]
        subprocess.run(
            [
                piper,
                "--model",
                model,
                "--output_file",
                str(dest),
                "--sentence_silence",
                "0",
                "--length_scale",
                "1.0",
                "--quiet",
            ],
            input=text + "\n",
            text=True,
            stdout=subprocess.DEVNULL,
            check=True,
        )
    else:
        subprocess.run(
            ["espeak-ng", "-v", "en-us", "-s", "152", "-w", str(dest), text],
            check=True,
        )
    normalized = dest.with_suffix(".norm.wav")
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(dest),
            "-ar",
            "22050",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(normalized),
        ],
        capture_output=True,
    )
    normalized.replace(dest)


def holds_for(durations: list[float]) -> list[float]:
    raw = [
        max(audio + LEAD + TAIL, MIN_HOLD[index] if index < len(MIN_HOLD) else 0.0)
        for index, audio in enumerate(durations)
    ]
    total = sum(raw)
    if total <= CONTENT_LIMIT:
        return raw
    pads = [hold - (audio + LEAD + 0.35) for hold, audio in zip(raw, durations)]
    pad_sum = sum(max(pad, 0.0) for pad in pads)
    slack = total - CONTENT_LIMIT
    if pad_sum <= slack + 0.01:
        raise SystemExit(
            f"Voice track is {total:.1f}s and cannot fit under {CONTENT_LIMIT:.0f}s without speeding speech up."
        )
    scale = (pad_sum - slack) / pad_sum
    return [audio + LEAD + 0.35 + max(pad, 0.0) * scale for audio, pad in zip(durations, pads)]


def prepare() -> None:
    sections = parse_sections(NARRATION.read_text(encoding="utf-8"))
    audio_dir = WORK / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    plan_sections = []
    durations = []
    cue_index = 0
    for section in sections:
        cues = []
        total = 0.0
        sentences = split_sentences(section["voice"])
        if not sentences:
            raise SystemExit(f"No sentences in {section['title']}.")
        for sentence in sentences:
            dest = audio_dir / f"{cue_index:03d}.wav"
            synthesize(speakable(sentence), dest)
            duration = wav_duration(dest)
            if duration < 0.2:
                raise SystemExit(f"Speech clip is too short: {sentence}")
            cues.append({"text": sentence, "wav": str(dest.relative_to(ROOT)), "duration": duration})
            total += duration
            if len(cues) > 1:
                total += CUE_GAP
            cue_index += 1
        durations.append(total)
        plan_sections.append(
            {"kind": section["kind"], "title": section["title"], "audio": total, "cues": cues}
        )
    chosen = holds_for(durations)
    pauses_ms = [int(math.ceil(hold * 1000)) for hold in chosen[1:]]
    plan = {
        "lead": LEAD,
        "cueGap": CUE_GAP,
        "endPad": END_PAD,
        "layoutSec": round(chosen[0], 3),
        "pausesMs": pauses_ms,
        "contentSec": round(sum(chosen), 3),
        "sections": plan_sections,
    }
    WORK.mkdir(parents=True, exist_ok=True)
    (WORK / "plan.json").write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
    timing = WORK / "timing.txt"
    env = "\n".join(
        [
            f"export LAYOUT_SEC={plan['layoutSec']:.3f}",
            "export DEMO_PAUSE_LIST=" + ",".join(str(value) for value in pauses_ms),
            f"export DEMO_TIMING_FILE={timing}",
            "",
        ]
    )
    (WORK / "session.env").write_text(env, encoding="utf-8")
    print(f"TTS engine: {os.environ.get('TTS_ENGINE', 'piper')}")
    print(f"{'section':<28} {'audio':>8} {'hold':>8}")
    for section, audio, hold in zip(plan_sections, durations, chosen):
        label = section["title"][:28]
        print(f"{label:<28} {audio:8.2f} {hold:8.2f}")
    print(f"{'total':<28} {sum(durations):8.2f} {sum(chosen):8.2f}")


def srt_time(seconds: float) -> str:
    millis = max(0, int(round(seconds * 1000)))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def wrap_cue(text: str, width: int = 68) -> str:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = word if not current else f"{current} {word}"
        if len(trial) <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    if len(lines) <= 2:
        return "\n".join(lines)
    midpoint = math.ceil(len(lines) / 2)
    return "\n".join([" ".join(lines[:midpoint]), " ".join(lines[midpoint:])])


def escape_srt(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def read_timing(path: Path) -> tuple[int, list[int]]:
    layout: int | None = None
    scenes: dict[int, int] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        kind, raw = line.split()
        if kind == "layout":
            layout = int(raw)
        else:
            scenes[int(kind)] = int(raw)
    if layout is None or sorted(scenes) != list(range(9)):
        raise SystemExit(f"Timing file is missing the layout or a scene: {path}")
    return layout, [scenes[index] for index in range(9)]


def slate_end(video: Path) -> float:
    """Return the timestamp just after the magenta slate.

    The slate is a band of pink, not a full-frame fill, so this looks for pink
    pixels in a downscaled frame instead of a bright center.
    """
    fps = 20
    width, height = 96, 80
    frame_bytes = width * height * 3
    result = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-t",
            "8",
            "-i",
            str(video),
            "-vf",
            f"fps={fps},scale={width}:{height},format=rgb24",
            "-f",
            "rawvideo",
            "-",
        ],
        check=True,
        capture_output=True,
    )
    data = result.stdout
    frames = len(data) // frame_bytes
    last_pink: int | None = None
    for index in range(frames):
        frame = data[index * frame_bytes : (index + 1) * frame_bytes]
        pink = 0
        for offset in range(0, frame_bytes, 3):
            red, green, blue = frame[offset], frame[offset + 1], frame[offset + 2]
            if red > 180 and blue > 120 and green < 190 and red > green + 40:
                pink += 1
        if pink > 20:
            last_pink = index
    if last_pink is None:
        raise SystemExit("Could not find the magenta sync slate in the terminal recording.")
    return (last_pink + 1) / fps + 0.02


def make_silence(path: Path, seconds: float) -> None:
    if seconds <= 0.01:
        path.write_bytes(b"")
        return
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "anullsrc=r=22050:cl=mono",
            "-t",
            f"{seconds:.3f}",
            "-c:a",
            "pcm_s16le",
            str(path),
        ],
        capture_output=True,
    )


def assemble() -> None:
    plan = json.loads((WORK / "plan.json").read_text(encoding="utf-8"))
    layout_ms, scene_ms = read_timing(WORK / "timing.txt")
    video = WORK / "terminal.mp4"
    start = slate_end(video)
    starts = [0.0] + [(stamp - layout_ms) / 1000 for stamp in scene_ms]
    last_pause = plan["pausesMs"][-1] / 1000
    duration = starts[-1] + last_pause + float(plan["endPad"])
    if duration >= 179:
        raise SystemExit(f"Edit is {duration:.1f}s, which is over the 3 minute limit.")

    pieces: list[tuple[str, str | float]] = []
    cursor = 0.0
    cues: list[tuple[float, float, str]] = []
    for section, section_start in zip(plan["sections"], starts):
        cue_at = section_start + float(plan["lead"])
        for cue_index, cue in enumerate(section["cues"]):
            if cue_index:
                cue_at += float(plan["cueGap"])
            cue_end = cue_at + float(cue["duration"])
            if cue_end > duration - 0.05:
                raise SystemExit(f"Cue runs past the edit: {cue['text']}")
            cues.append((cue_at, cue_end, cue["text"]))
            pieces.append(("silence", cue_at - cursor))
            pieces.append(("wav", cue["wav"]))
            cursor = cue_end
            cue_at = cue_end
    pieces.append(("silence", max(0.0, duration - cursor)))

    concat = WORK / "concat.txt"
    silence_dir = WORK / "silence"
    silence_dir.mkdir(parents=True, exist_ok=True)
    lines = []
    silence_index = 0
    for kind, value in pieces:
        if kind == "wav":
            lines.append(f"file '{(ROOT / str(value)).as_posix()}'")
            continue
        seconds = float(value)
        if seconds <= 0.01:
            continue
        silence = silence_dir / f"{silence_index:03d}.wav"
        silence_index += 1
        make_silence(silence, seconds)
        lines.append(f"file '{silence.as_posix()}'")
    concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
    voice = WORK / "voice.wav"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat),
            "-ar",
            "48000",
            "-ac",
            "2",
            "-c:a",
            "pcm_s16le",
            str(voice),
        ],
        capture_output=True,
    )

    blocks = []
    for index, (cue_start, cue_end, text) in enumerate(cues, start=1):
        blocks.append(f"{index}\n{srt_time(cue_start)} --> {srt_time(cue_end)}\n{escape_srt(wrap_cue(text))}\n")
    SRT_PATH.write_text("\n".join(blocks) + "\n", encoding="utf-8")
    edit = {"start": round(start, 3), "duration": round(duration, 3)}
    (WORK / "edit.json").write_text(json.dumps(edit, indent=2) + "\n", encoding="utf-8")
    print(f"Slate ends at {start:.3f}s. Edit length {duration:.3f}s. Cues: {len(cues)}.")


def main() -> None:
    if len(sys.argv) != 2 or sys.argv[1] not in {"prepare", "assemble"}:
        raise SystemExit("Usage: build_audio.py prepare|assemble")
    if sys.argv[1] == "prepare":
        prepare()
    else:
        assemble()


if __name__ == "__main__":
    main()
