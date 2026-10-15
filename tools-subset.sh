#!/usr/bin/env bash
# 重新裁剪字体（改了字幕 / 地名 / 题记以后跑）：扫描 src/ 和字幕稿里用到的汉字。需要 fonttools（pip install fonttools brotli）和原字体文件
# 用法：PY=python FONT_DIR=原字体目录 bash tools-subset.sh
set -e
PY=${PY:-python3}
CHARS=$(mktemp)
$PY -c "import glob,sys; t=''.join(open(f,encoding='utf-8').read() for f in glob.glob('src/*.js')+glob.glob('*.md')+['index.html']); print(''.join(sorted(set(c for c in t if ord(c)>0x2e80))))" > $CHARS
$PY -m fontTools.subset "$FONT_DIR/MaShanZheng-Regular.ttf" --text-file=$CHARS --unicodes="U+0030-0039" --flavor=woff2 --output-file=fonts/MaShanZheng.subset.woff2
for w in Regular Bold; do $PY -m fontTools.subset "$FONT_DIR/NotoSerifCJK-$w.ttc" --font-number=2 --text-file=$CHARS --unicodes="U+0020-007E,U+00B7,U+2014,U+2018-201D,U+2026" --flavor=woff2 --output-file=fonts/NotoSerifSC-$w.subset.woff2; done
echo "字体已更新（$(wc -m < $CHARS) 个字）"
