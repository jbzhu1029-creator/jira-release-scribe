#!/usr/bin/env bash
# Record the faceless offline demo and mux narration, captions, and video.
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=C

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing $1. See the README section \"Re-render the demo video\"." >&2
    exit 1
  fi
}

need ffmpeg
need ffprobe
need python3
need node
need npm
need vhs
need ttyd

tools="demo/work/tools"
mkdir -p "$tools/voices"
piper_bin="$tools/piper/piper"
piper_model="$tools/voices/en_US-lessac-medium.onnx"

if [[ ! -x "$piper_bin" ]]; then
  echo "Downloading Piper..."
  curl -fL --retry 3 -o "$tools/piper.tar.gz" \
    "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz"
  tar -xzf "$tools/piper.tar.gz" -C "$tools"
fi

if [[ ! -f "$piper_model" ]]; then
  echo "Downloading the Piper lessac voice..."
  curl -fL --retry 3 -o "$piper_model" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
  curl -fL --retry 3 -o "${piper_model}.json" \
    "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"
fi

if [[ -x "$piper_bin" && -f "$piper_model" ]]; then
  export TTS_ENGINE=piper
  export PIPER_BIN="$piper_bin"
  export PIPER_MODEL="$piper_model"
  export LD_LIBRARY_PATH="$(dirname "$piper_bin")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
else
  need espeak-ng
  echo "Piper is unavailable. Using espeak-ng."
  export TTS_ENGINE=espeak
fi

python3 demo/build_audio.py prepare

# Warm the TypeScript loader so the recorded startup is short.
npm run -s demo -- --fast >/dev/null

sleep_sec="$(python3 -c 'import json; plan=json.load(open("demo/work/plan.json")); print(int(plan["contentSec"] + 25))')"
cat > demo/work/session.tape << EOF
Output "demo/work/terminal.mp4"
Require node
Require npm
Require ffmpeg
Set Shell bash
Set FontFamily "JetBrains Mono"
Set FontSize 22
Set LineHeight 1.0
Set LetterSpacing 0
Set Columns 110
Set Rows 40
Set Padding 16
Set Framerate 30
Set TypingSpeed 1ms
Set Theme "Catppuccin Mocha"
Set WindowBar Colorful
Set WindowBarSize 30
Set CursorBlink false
Env PS1 "$ "
Type@1ms "exec bash --noprofile --norc ./demo/record_session.sh"
Enter
Sleep ${sleep_sec}s
EOF
cp demo/work/session.tape demo/release-scribe.tape

echo "Recording the terminal (${sleep_sec}s of tape)..."
vhs demo/work/session.tape

python3 demo/build_audio.py assemble

python3 - << 'PY'
import json
from pathlib import Path

edit = json.loads(Path("demo/work/edit.json").read_text())
srt = Path("demo/release-scribe-demo.srt").read_text(encoding="utf-8")

def ass_time(value: str) -> str:
    clock, millis = value.strip().split(",")
    hours, minutes, seconds = clock.split(":")
    centis = int(millis) // 10
    return f"{int(hours)}:{minutes}:{seconds}.{centis:02d}"

events = []
for block in srt.strip().split("\n\n"):
    parts = block.splitlines()
    if len(parts) < 3 or "-->" not in parts[1]:
        continue
    start, end = [ass_time(piece) for piece in parts[1].split("-->")]
    text = "\\N".join(parts[2:]).replace("{", "\\{").replace("}", "\\}")
    events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Liberation Sans,30,&H00FFFFFF,&H000000FF,&H001E1E2E,&H001E1E2E,0,0,0,0,100,100,0,0,3,12,0,2,80,80,36,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""" + "\n".join(events) + "\n"
Path("demo/work/captions.ass").write_text(ass, encoding="utf-8")
font_dir = "/usr/share/fonts/truetype/liberation"
filter_text = (
    f"[0:v]trim=start={edit['start']}:duration={edit['duration']},setpts=PTS-STARTPTS,"
    "scale=1920:920:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1,"
    "pad=1920:1080:(ow-iw)/2:20:color=0x1e1e2e,"
    f"subtitles=demo/work/captions.ass:fontsdir={font_dir}[v]"
)
Path("demo/work/filter.txt").write_text(filter_text + "\n")
PY

ffmpeg -y \
  -i demo/work/terminal.mp4 \
  -i demo/work/voice.wav \
  -filter_complex_script demo/work/filter.txt \
  -map "[v]" -map 1:a:0 \
  -t "$(python3 -c 'import json; print(json.load(open("demo/work/edit.json"))["duration"])')" \
  -c:v libx264 -profile:v high -pix_fmt yuv420p -crf 20 -preset medium \
  -c:a aac -b:a 160k -ar 48000 -ac 2 \
  -movflags +faststart \
  -metadata title="Release Scribe offline demo" \
  -metadata comment="Sample Jira fixtures on this machine. Not installed on an Atlassian site." \
  demo/release-scribe-demo.mp4

python3 - << 'PY'
import json
import subprocess
from pathlib import Path

path = Path("demo/release-scribe-demo.mp4")
probe = json.loads(subprocess.check_output([
    "ffprobe", "-v", "error", "-show_entries",
    "format=duration,size:stream=codec_name,codec_type,width,height",
    "-of", "json", str(path),
], text=True))
streams = {item["codec_type"]: item for item in probe["streams"]}
video = streams["video"]
audio = streams["audio"]
duration = float(probe["format"]["duration"])
size = int(probe["format"]["size"])
problems = []
if video.get("codec_name") != "h264" or audio.get("codec_name") != "aac":
    problems.append(f"codecs {video.get('codec_name')}/{audio.get('codec_name')}")
if int(video.get("width", 0)) != 1920 or int(video.get("height", 0)) != 1080:
    problems.append(f"dimensions {video.get('width')}x{video.get('height')}")
if duration >= 180:
    problems.append(f"duration {duration:.2f}s")
if size >= 50 * 1024 * 1024:
    problems.append(f"size {size} bytes")
if problems:
    raise SystemExit("Video check failed: " + "; ".join(problems))
print(f"OK {duration:.2f}s {size / (1024 * 1024):.1f} MiB 1920x1080 h264/aac")
PY
