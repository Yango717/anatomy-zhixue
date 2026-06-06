#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Update MotionFlowPage.jsx to display atlas images."""
import sys, io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

filepath = r'd:\ABstuye\client\src\pages\MotionFlowPage.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File length: {len(content)} chars")

# Find the placeholder text position
hint_pos = content.find('图谱图片待匹配到实际文件')
print(f"Placeholder found at position: {hint_pos}")

# Get surrounding context to find correct boundaries
if hint_pos > 0:
    # Find the encompassing div
    start = content.rfind('<div className="motion-atlas-card__image-ref">', 0, hint_pos)
    end = content.find('</div>', hint_pos) + len('</div>')
    print(f"Block 1: start={start}, end={end}")
    print(f"Old block:")
    print(content[start:end])
    print("---")

# Find second occurrence
hint_pos2 = content.find('图谱回顾')
print(f"\nReview section found at: {hint_pos2}")

# --- Apply changes ---

# Block 1: Step 1 atlas display (around the placeholder)
if hint_pos > 0:
    old_block = content[start:end]
    new_block = '''<div className="motion-atlas-card__image-ref">
                    {(atlasCards[atlasIndex]?.imageUrls?.length > 0) ? (
                      <div className="motion-atlas-card__images">
                        {atlasCards[atlasIndex].imageUrls.map((url, i) => (
                          <img key={i} src={url} alt={atlasCards[atlasIndex]?.title || ''} className="motion-atlas-card__img" loading="lazy" />
                        ))}
                      </div>
                    ) : (
                      <>
                        <p className="motion-atlas-card__image-name">{atlasCards[atlasIndex]?.image}</p>
                        <p className="motion-atlas-card__image-hint">图谱图片待匹配到实际文件</p>
                      </>
                    )}
                  </div>'''
    content = content.replace(old_block, new_block)
    print("[OK] Updated step 1 atlas image section")

# Block 2: Review section atlas display
if hint_pos2 > 0:
    # Find the review atlas card section
    review_start = content.find('{allReviewCards[errorCardIdx]?.type === "atlas" ? (', hint_pos2 - 200)
    if review_start < 0:
        review_start = content.find('{allReviewCards[errorCardIdx]?.type === "atlas" ? (')

    # Find the structures div that follows
    structures_pos = content.find('<div className="motion-atlas-card__structures">', review_start)

    if review_start >= 0 and structures_pos > review_start:
        # Get the header + content between "atlas ? (" and structures div
        pre_block = content[review_start:structures_pos]
        print(f"\nReview block length: {len(pre_block)}")

        new_review_block = '''{allReviewCards[errorCardIdx]?.type === "atlas" ? (
                  <div className="motion-atlas-card">
                    <div className="motion-atlas-card__header">
                      <span className="motion-atlas-card__tag">图谱回顾</span>
                      <span className="motion-atlas-card__title">{allReviewCards[errorCardIdx]?.title}</span>
                    </div>
                    {(allReviewCards[errorCardIdx]?.imageUrls?.length > 0) && (
                      <div className="motion-atlas-card__images">
                        {allReviewCards[errorCardIdx].imageUrls.map((url, i) => (
                          <img key={i} src={url} alt={allReviewCards[errorCardIdx]?.title || ''} className="motion-atlas-card__img" loading="lazy" />
                        ))}
                      </div>
                    )}
                    <div className="motion-atlas-card__structures">'''
        content = content.replace(pre_block, new_review_block)
        print("[OK] Updated step 4 review atlas section")
    else:
        print(f"[ERR] Could not find review block boundaries: review_start={review_start}, structures_pos={structures_pos}")

# Write back
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("\n[DONE] File saved")
