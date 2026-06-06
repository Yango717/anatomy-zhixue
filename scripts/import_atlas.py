#!/usr/bin/env python3
"""
Import atlas images for Chapter 01 (运动系统).

Reads atlas_cards.json, matches each card to image files,
copies images to the project content directory, and updates
the atlas_cards.json with image file paths.
"""
import json, os, re, sys, shutil
from pathlib import Path

# Paths
CONTENT_DIR = Path(r"d:\ABstuye\client\dist\content")
IMG_SRC_DIR = Path(r"C:\Users\21109\Desktop\系统解剖学图谱_第一章")

# Find chapter-01 directory
def find_chapter_dir():
    for d in CONTENT_DIR.iterdir():
        if d.is_dir() and d.name.startswith("chapter-01"):
            return d
    return None

CHAPTER_DIR = find_chapter_dir()
if not CHAPTER_DIR:
    print("ERROR: chapter-01 directory not found!")
    sys.exit(1)

ATLAS_CARDS_PATH = CHAPTER_DIR / "atlas_cards.json"
ATLAS_IMG_DIR = CHAPTER_DIR / "atlas"

# === CARD → FILE MAPPING ===
# Derived from automated matching + manual verification
# Format: card_image_field → [list of matching filenames]
CARD_FILE_MAP = {
    # 骨学 — 骨的构造
    "图1-2 骨的内部构造": ["图02_骨的内部构造.jpeg"],
    "图1-3 长骨的构造": ["图03_长骨的构造.jpeg"],

    # 骨学 — 躯干骨
    "图1-6 胸椎": ["图07_胸椎.jpeg"],
    "图1-7 颈椎": ["图07_颈椎（上面）.jpeg"],
    "图1-11 腰椎": ["图08_腰椎.jpeg"],
    "图1-12 骶骨和尾骨": ["图09_骶骨和尾骨.jpeg"],
    "图1-13 胸骨": ["图10_胸骨（前面）.jpeg"],
    "图1-14 肋骨": ["图10_肋骨.jpeg"],

    # 骨学 — 颅骨
    "图1-25 颅底内面观": ["图16_颅底内面观.jpeg"],

    # 骨学 — 上肢骨
    "图1-35 锁骨": ["图21_锁骨.jpeg"],
    "图1-36/37 肩胛骨": ["图22_肩胛骨（前面）.jpeg", "图22_肩胛骨（后面）.jpeg"],
    "图1-38 肱骨": ["图22_肱骨.jpeg"],
    "图1-39 桡骨和尺骨": ["图23_桡骨和尺骨.jpeg"],
    "图1-40 手骨": ["图24_手骨.jpeg"],

    # 骨学 — 下肢骨
    "图1-41/42 髋骨": ["图25_髋骨（外面）.jpeg", "图25_髋骨（内面）.jpeg"],
    "图1-44 股骨": ["图26_股骨.jpeg"],
    "图1-46 胫骨和腓骨": ["图27_胫骨和腓骨（右侧）.jpeg"],
    "图1-47 足骨": ["图27_足骨.jpeg"],

    # 关节学
    "图1-49 滑膜关节的构造": ["图30_滑膜关节的构造.jpeg"],
    "图1-51 椎间盘": ["图32_椎间盘和关节突（腰椎上面）.jpeg"],
    "图1-56 脊柱": ["图35_脊柱.jpeg"],
    "图1-59 胸廓": ["图37_胸廓（前面）.jpeg"],
    "图1-62 肩关节": ["图39_肩关节.jpeg"],
    "图1-63 肘关节": ["图40_肘关节.jpeg"],
    "图1-70/71 髋关节": ["图45_髋关节.jpeg", "图45_髋关节（冠状切面）.jpeg"],
    "图1-72 膝关节": ["图46_膝关节.jpeg"],
    "图1-68 骨盆": ["图43_骨盆的韧带.jpeg"],

    # 肌学
    "图1-77 肌的各种形态": ["图50_肌的各种形态.jpeg"],
    "图1-80 腱鞘示意图": ["图51_腱鞘示意图.jpeg"],
    "图1-81/82 头肌": ["图52_头肌（前面）.jpeg", "图53_头肌（侧面）.jpeg"],

    # 肌学配图
    "肌学配图-躯干肌": ["图58_背肌.jpeg", "图60_胸肌.jpeg", "图63_腹前外侧壁肌.jpeg"],
    "肌学配图-上肢肌": [
        "图66_上肢带肌与臂肌前群.jpeg",
        "图66_上肢带肌与臂肌后群.jpeg",
        "图68_前臂肌前群（浅层）.jpeg",
        "图69_前臂肌后群（浅层）.jpeg",
    ],
    "肌学配图-下肢肌": [
        "图72_髋肌、大腿肌前群及内侧群.jpeg",
        "图76_小腿肌.jpeg",
        "图77_小腿肌后群.jpeg",
    ],
}


def main():
    # Load atlas cards
    with open(ATLAS_CARDS_PATH, "r", encoding="utf-8") as f:
        cards = json.load(f)
    print(f"Loaded {len(cards)} atlas cards")

    # Verify all source files exist
    all_needed = set()
    for files in CARD_FILE_MAP.values():
        all_needed.update(files)

    missing = []
    for fname in all_needed:
        fpath = IMG_SRC_DIR / fname
        if not fpath.exists():
            missing.append(fname)

    if missing:
        print(f"WARNING: {len(missing)} source files missing:")
        for m in missing:
            print(f"  MISSING: {m}")

    # Create atlas image directory
    ATLAS_IMG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Atlas image dir: {ATLAS_IMG_DIR}")

    # Copy images and update cards
    copied = 0
    updated_cards = []

    for card in cards:
        img_ref = card.get("image", "")
        card_id = card.get("id", "")

        new_card = dict(card)
        matched_files = CARD_FILE_MAP.get(img_ref, [])

        if matched_files:
            # Sanitize filenames for web (no spaces/special chars in URL)
            # We'll rename to safe names
            safe_names = []

            for i, fname in enumerate(matched_files):
                src = IMG_SRC_DIR / fname
                if not src.exists():
                    print(f"  SKIP (missing): {fname}")
                    continue

                # Create safe filename: atlas-{card_id}-{index}.jpg
                ext = src.suffix.lower()
                if len(matched_files) == 1:
                    safe_name = f"{card_id}.jpg"
                else:
                    safe_name = f"{card_id}_{i+1}.jpg"

                dst = ATLAS_IMG_DIR / safe_name

                # Copy if not already there or source is newer
                if not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime:
                    shutil.copy2(src, dst)
                    print(f"  COPY: {fname} → atlas/{safe_name}")
                else:
                    print(f"  SKIP (up to date): atlas/{safe_name}")

                safe_names.append(safe_name)
                copied += 1

            new_card["images"] = safe_names
        else:
            print(f"  NO IMAGE: [{card_id}] {img_ref}")
            new_card["images"] = []

        updated_cards.append(new_card)

    # Save updated atlas_cards.json
    backup_path = ATLAS_CARDS_PATH.with_suffix(".json.bak")
    if not backup_path.exists():
        shutil.copy2(ATLAS_CARDS_PATH, backup_path)
        print(f"Backup: {backup_path}")

    with open(ATLAS_CARDS_PATH, "w", encoding="utf-8") as f:
        json.dump(updated_cards, f, ensure_ascii=False, indent=2)
    print(f"Updated: {ATLAS_CARDS_PATH}")

    # Summary
    cards_with_images = sum(1 for c in updated_cards if c.get("images"))
    print(f"\n{'='*50}")
    print(f"IMPORT COMPLETE")
    print(f"  Cards with images: {cards_with_images} / {len(cards)}")
    print(f"  Files copied: {copied}")
    print(f"  Atlas dir: {ATLAS_IMG_DIR}")
    print(f"{'='*50}")

    # List redundant files
    all_img_files = set()
    for f in IMG_SRC_DIR.iterdir():
        if f.suffix.lower() in ('.jpeg', '.jpg', '.png', '.webp', '.gif'):
            all_img_files.add(f.name)

    redundant = all_img_files - all_needed
    if redundant:
        print(f"\n{len(redundant)} redundant files (未导入):")
        for f in sorted(redundant):
            print(f"  {f}")


if __name__ == "__main__":
    main()
