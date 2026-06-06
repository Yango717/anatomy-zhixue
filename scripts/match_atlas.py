#!/usr/bin/env python3
"""Match atlas image files to atlas_cards.json entries — improved matching."""
import json, os, re, sys

CONTENT_DIR = r"d:\ABstuye\client\dist\content"
IMG_DIR = r"C:\Users\21109\Desktop\系统解剖学图谱_第一章"

# Generic direction/location terms to exclude from keyword matching
STOP_WORDS = {
    "上面", "下面", "前面", "后面", "内面", "外面", "侧面",
    "浅层", "深层", "右侧", "左侧", "前面观", "内面观", "外面观",
    "示意图", "模式图", "构造", "结构", "形态", "分类",
    "冠状切面", "水平切面", "整体观", "一般",
}

def find_atlas_file(content_dir):
    for root, dirs, files in os.walk(content_dir):
        if "chapter-01" in root and "atlas_cards.json" in files:
            return os.path.join(root, "atlas_cards.json")
    return None

def extract_keywords(card):
    """Extract meaningful keywords from a card."""
    img_name = card["image"]  # e.g. "图1-2 骨的内部构造"
    card_title = card["title"]

    # Primary: extract the descriptive part from image name (after figure number)
    # e.g. "图1-2 骨的内部构造" → ["骨的内部构造", "骨", "内部构造"]
    parts = img_name.split(None, 1)  # split on first whitespace
    keywords = []

    if len(parts) > 1:
        desc = parts[1]
        # Add the full description
        keywords.append(desc)
        # Split into meaningful chunks
        for chunk in re.split(r'[、，,（）()]', desc):
            chunk = chunk.strip()
            if len(chunk) >= 2 and chunk not in STOP_WORDS:
                keywords.append(chunk)

    # Secondary: from title (usually similar but sometimes more specific)
    if card_title not in keywords:
        keywords.append(card_title)
    for chunk in re.split(r'[、，,（）()\s]', card_title):
        chunk = chunk.strip()
        if len(chunk) >= 2 and chunk not in STOP_WORDS and chunk not in keywords:
            keywords.append(chunk)

    # Also extract from structures for context (top 3 most distinctive labels)
    structures = card.get("structures", [])
    for s in structures[:5]:
        label = s.get("label", "")
        if len(label) >= 2 and label not in STOP_WORDS and label not in keywords:
            keywords.append(label)

    return keywords

def score_match(keywords, filename_stem):
    """Score how well keywords match a filename."""
    score = 0
    for kw in keywords:
        if kw in filename_stem:
            # Longer keyword matches are worth more
            score += len(kw)
    return score

def main():
    atlas_path = find_atlas_file(CONTENT_DIR)
    if not atlas_path:
        print("ERROR: atlas_cards.json not found!")
        sys.exit(1)

    print(f"Loading: {atlas_path}")
    with open(atlas_path, "r", encoding="utf-8") as f:
        cards = json.load(f)
    print(f"Loaded {len(cards)} cards")

    all_files = []
    for f in os.listdir(IMG_DIR):
        if f.lower().endswith(('.jpeg', '.jpg', '.png', '.webp', '.gif')):
            all_files.append(f)
    print(f"Found {len(all_files)} image files")

    matched_files = set()
    results = []

    # Special manual mappings for known tricky cases
    MANUAL_MAP = {
        "图1-36/37 肩胛骨": ["图22_肩胛骨（前面）.jpeg", "图22_肩胛骨（后面）.jpeg"],
        "图1-41/42 髋骨": ["图25_髋骨（外面）.jpeg", "图25_髋骨（内面）.jpeg"],
        "图1-70/71 髋关节": ["图45_髋关节.jpeg", "图45_髋关节（冠状切面）.jpeg"],
        "图1-81/82 头肌": ["图52_头肌（前面）.jpeg", "图53_头肌（侧面）.jpeg"],
        "肌学配图-躯干肌": ["图58_背肌.jpeg", "图60_胸肌.jpeg", "图63_腹前外侧壁肌.jpeg"],
        "肌学配图-上肢肌": ["图66_上肢带肌与臂肌前群.jpeg", "图66_上肢带肌与臂肌后群.jpeg",
                           "图68_前臂肌前群（浅层）.jpeg", "图69_前臂肌后群（浅层）.jpeg"],
        "肌学配图-下肢肌": ["图72_髋肌、大腿肌前群及内侧群.jpeg", "图76_小腿肌.jpeg",
                           "图77_小腿肌后群.jpeg"],
    }

    for card in cards:
        img_name = card["image"]
        card_title = card["title"]

        # Check manual mapping first
        if img_name in MANUAL_MAP:
            files = MANUAL_MAP[img_name]
            valid = [f for f in files if f in all_files]
            if valid:
                print(f"[{img_name}] → MANUAL: {valid}")
                for f in valid:
                    matched_files.add(f)
                results.append((card, valid))
                continue

        keywords = extract_keywords(card)
        # Remove duplicates
        seen = set()
        keywords = [k for k in keywords if not (k in seen or seen.add(k))]

        # Find best match
        candidates = []
        for f in all_files:
            if f in matched_files:
                continue
            f_stem = f.rsplit(".", 1)[0]
            s = score_match(keywords, f_stem)
            if s > 0:
                candidates.append((f, s))

        candidates.sort(key=lambda x: -x[1])

        if candidates:
            best = candidates[0]
            # Only accept if score is high enough (len of best keyword match >= 3 chars)
            if best[1] >= 3:
                print(f"[{img_name}] → {best[0]} (score={best[1]})")
                matched_files.add(best[0])
                results.append((card, [best[0]]))
            else:
                print(f"[{img_name}] → LOW SCORE: {best[0]} (score={best[1]}) — showing top candidates:")
                for c in candidates[:5]:
                    print(f"  candidate: {c[0]} (score={c[1]})")
                results.append((card, []))
        else:
            print(f"[{img_name}] → NO MATCH! keywords={keywords[:8]}")
            results.append((card, []))

    matched_count = sum(1 for r in results if r[1])
    print(f"\n{'='*60}")
    print(f"CARDS WITH IMAGES: {matched_count} / {len(cards)}")
    print(f"UNMATCHED FILES (likely redundant): {len(all_files) - len(matched_files)}")
    print(f"{'='*60}")

    unmatched = [f for f in sorted(all_files) if f not in matched_files]
    for f in unmatched:
        print(f"  REDUNDANT: {f}")

    # Save mapping
    chapter_dir = os.path.dirname(atlas_path)
    mapping = []
    for card, files in results:
        mapping.append({
            "card_id": card["id"],
            "image_ref": card["image"],
            "title": card["title"],
            "files": files,
            "page": card["page"]
        })

    out_path = os.path.join(chapter_dir, "atlas_image_map.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"\nMapping saved to: {out_path}")

if __name__ == "__main__":
    main()
