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
Sleep 191s
