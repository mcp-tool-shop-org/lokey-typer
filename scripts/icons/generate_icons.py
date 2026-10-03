"""
LoKey Typer — SVG Icon Sprite Library Generator

Design language:
  - 24×24 viewBox, monoline, 1.5px stroke, round caps/joins
  - No fills (stroke-only), currentColor for easy theming
  - Zen-minimal: clean geometry with subtle organic curves
  - NOT Asian-zen tropes — think Dieter Rams meets Muji
"""

import os
import math

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

SVG_HEAD = '''<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
'''
SVG_TAIL = '</svg>\n'


def save(name: str, body: str):
    path = os.path.join(OUT_DIR, f'{name}.svg')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(SVG_HEAD + body + SVG_TAIL)
    print(f'  + {name}.svg')


def circle(cx, cy, r):
    return f'  <circle cx="{cx}" cy="{cy}" r="{r}" />\n'


def line(x1, y1, x2, y2):
    return f'  <line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" />\n'


def path(d):
    return f'  <path d="{d}" />\n'


def rect(x, y, w, h, rx=0):
    if rx:
        return f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" />\n'
    return f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" />\n'


def polyline(points):
    pts = ' '.join(f'{x},{y}' for x, y in points)
    return f'  <polyline points="{pts}" />\n'


# ─────────────────────────────────────────────
# BRAND / APP
# ─────────────────────────────────────────────

def icon_logo():
    """LoKey logo — a minimal keyboard key with a subtle glow/pulse ring.
    Square key shape with rounded corners + a centered dot."""
    body = ''
    # Outer soft ring (the "pulse" / zen aura)
    body += f'  <rect x="4" y="4" width="16" height="16" rx="4" opacity="0.3" />\n'
    # Key shape
    body += rect(6, 6, 12, 12, 3)
    # Center dot — the calm focus point
    body += circle(12, 12, 1.5)
    save('logo', body)


def icon_logo_mark():
    """Smaller mark version — just the key + dot, no aura."""
    body = rect(5, 5, 14, 14, 3.5)
    body += circle(12, 12, 2)
    save('logo-mark', body)


# ─────────────────────────────────────────────
# NAVIGATION / ACTIONS
# ─────────────────────────────────────────────

def icon_home():
    """Home — a simple house silhouette, monoline."""
    body = path('M3 12 L12 4 L21 12')
    body += path('M6 12 L6 19 C6 19.5 6.5 20 7 20 L10 20 L10 15 L14 15 L14 20 L17 20 C17.5 20 18 19.5 18 19 L18 12')
    save('home', body)


def icon_play():
    """Play / Start — a soft triangle, not aggressive."""
    body = path('M8 5.5 L8 18.5 L19 12 Z')
    save('play', body)


def icon_play_circle():
    """Play inside a circle — for the big CTA button."""
    body = circle(12, 12, 9)
    body += path('M10 8.5 L10 15.5 L16.5 12 Z')
    save('play-circle', body)


def icon_arrow_right():
    """Simple right arrow."""
    body = line(5, 12, 19, 12)
    body += polyline([(14, 7), (19, 12), (14, 17)])
    save('arrow-right', body)


def icon_arrow_left():
    """Simple left arrow."""
    body = line(19, 12, 5, 12)
    body += polyline([(10, 7), (5, 12), (10, 17)])
    save('arrow-left', body)


def icon_chevron_right():
    """Chevron right — for link indicators."""
    body = polyline([(9, 6), (15, 12), (9, 18)])
    save('chevron-right', body)


def icon_chevron_down():
    """Chevron down."""
    body = polyline([(6, 9), (12, 15), (18, 9)])
    save('chevron-down', body)


def icon_external():
    """External link — box with arrow."""
    body = path('M18 13 L18 19 C18 19.5 17.5 20 17 20 L5 20 C4.5 20 4 19.5 4 19 L4 7 C4 6.5 4.5 6 5 6 L11 6')
    body += line(20, 4, 12, 12)
    body += polyline([(14, 4), (20, 4), (20, 10)])
    save('external', body)


def icon_settings():
    """Settings — a single gear, minimal teeth."""
    # Outer gear shape via path
    body = circle(12, 12, 3)
    # Simplified gear: 6 small lines radiating out
    for angle_deg in range(0, 360, 60):
        a = math.radians(angle_deg)
        x1 = 12 + 5.5 * math.cos(a)
        y1 = 12 + 5.5 * math.sin(a)
        x2 = 12 + 7.5 * math.cos(a)
        y2 = 12 + 7.5 * math.sin(a)
        body += line(round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1))
    save('settings', body)


def icon_refresh():
    """Refresh — circular arrow."""
    body = path('M4 12 A8 8 0 1 1 7.03 18.36')
    body += polyline([(4, 16), (4, 12), (8, 12)])
    save('refresh', body)


def icon_x_close():
    """Close X."""
    body = line(6, 6, 18, 18)
    body += line(18, 6, 6, 18)
    save('x-close', body)


def icon_check():
    """Checkmark — clean, not heavy."""
    body = polyline([(5, 13), (10, 18), (19, 6)])
    save('check', body)


def icon_info():
    """Info — circle with i."""
    body = circle(12, 12, 9)
    body += line(12, 16, 12, 12)
    body += circle(12, 8, 0.5)
    save('info', body)


def icon_question():
    """Question mark in circle."""
    body = circle(12, 12, 9)
    body += path('M9.5 9.5 C9.5 7.5 11 6.5 12 6.5 C13 6.5 14.5 7.5 14.5 9 C14.5 10.5 13 11 12 11.5 L12 13')
    body += circle(12, 16, 0.5)
    save('question', body)


# ─────────────────────────────────────────────
# MODE ICONS — zen without the tropes
# ─────────────────────────────────────────────

def icon_mode_focus():
    """Focus mode — a calm ripple / concentric circles.
    Think: a stone dropped in still water. Quiet, centered."""
    body = circle(12, 12, 2)
    body += f'  <circle cx="12" cy="12" r="6" opacity="0.6" />\n'
    body += f'  <circle cx="12" cy="12" r="10" opacity="0.3" />\n'
    save('mode-focus', body)


def icon_mode_real_life():
    """Real-Life mode — a document / page with lines.
    Represents emails, texts, real writing. Clean and professional."""
    body = rect(5, 3, 14, 18, 2)
    body += line(8, 8, 16, 8)
    body += line(8, 11.5, 16, 11.5)
    body += line(8, 15, 13, 15)
    save('mode-real-life', body)


def icon_mode_competitive():
    """Competitive mode — a stopwatch / timer.
    Speed, precision, measurement. Not aggressive."""
    # Watch body
    body = circle(12, 13, 8)
    # Top button/stem
    body += line(12, 3, 12, 5)
    body += line(10, 3, 14, 3)
    # Clock hands — minute pointing to 2 o'clock
    body += line(12, 13, 12, 8)
    body += line(12, 13, 15.5, 10.5)
    save('mode-competitive', body)


# ─────────────────────────────────────────────
# STATS / METRICS
# ─────────────────────────────────────────────

def icon_stat_speed():
    """WPM / Speed — a subtle gauge / speedometer needle.
    Not a running person — more like a clean dial."""
    # Arc (gauge)
    body = path('M4 18 A10 10 0 0 1 20 18')
    # Needle pointing up-right (fast but controlled)
    body += line(12, 16, 16, 8)
    # Center pivot
    body += circle(12, 16, 1.5)
    save('stat-speed', body)


def icon_stat_accuracy():
    """Accuracy — a target/crosshair. Clean concentric circles + center dot."""
    body = circle(12, 12, 9)
    body += circle(12, 12, 5)
    body += circle(12, 12, 1.5)
    save('stat-accuracy', body)


def icon_stat_sessions():
    """Sessions / Count — stacked layers, like pages or sessions."""
    body = rect(6, 3, 14, 14, 2)
    body += path('M4 8 L4 19 C4 20.1 4.9 21 6 21 L16 21')
    save('stat-sessions', body)


def icon_stat_days():
    """Days practiced — a calendar grid, minimal."""
    body = rect(3, 5, 18, 16, 2)
    body += line(3, 10, 21, 10)
    body += line(8, 3, 8, 7)
    body += line(16, 3, 16, 7)
    # Small dots for days
    for row in range(2):
        for col in range(4):
            cx = 6.5 + col * 3.5
            cy = 13 + row * 3.5
            body += circle(cx, cy, 0.7)
    save('stat-days', body)


def icon_stat_streak():
    """Streak — a small flame, organic but simple.
    Not emoji-style, more like a gentle candle flame."""
    body = path('M12 3 C12 3 8 8 8 13 C8 16.3 9.8 19 12 21 C14.2 19 16 16.3 16 13 C16 8 12 3 12 3 Z')
    # Inner highlight
    body += path('M12 10 C12 10 10.5 12.5 10.5 14.5 C10.5 16 11.2 17 12 18 C12.8 17 13.5 16 13.5 14.5 C13.5 12.5 12 10 12 10 Z')
    save('stat-streak', body)


# ─────────────────────────────────────────────
# TYPING / SESSION
# ─────────────────────────────────────────────

def icon_cursor():
    """Text cursor / caret — the typing indicator."""
    body = line(12, 4, 12, 20)
    body += line(9, 4, 15, 4)
    body += line(9, 20, 15, 20)
    save('cursor', body)


def icon_keyboard():
    """Keyboard — simplified top-down view."""
    body = rect(2, 6, 20, 12, 2)
    # Top row keys
    for i in range(5):
        x = 5 + i * 3
        body += rect(x, 9, 2, 2, 0.5)
    # Bottom row (space bar)
    body += rect(7, 13, 10, 2, 0.5)
    save('keyboard', body)


def icon_type_text():
    """Text/typing — lines of text being typed."""
    body = line(4, 7, 20, 7)
    body += line(4, 12, 16, 12)
    body += line(4, 17, 12, 17)
    # Cursor at end of last line
    body += line(13, 15, 13, 19)
    save('type-text', body)


def icon_backspace():
    """Backspace — arrow pointing left with an X."""
    body = path('M20 6 L20 18 L9 18 L3 12 L9 6 Z')
    body += line(11, 10, 16, 14)
    body += line(16, 10, 11, 14)
    save('backspace', body)


# ─────────────────────────────────────────────
# ACHIEVEMENTS / REWARDS
# ─────────────────────────────────────────────

def icon_trophy():
    """Trophy — for personal bests. Clean, not ornate."""
    # Cup
    body = path('M6 4 L6 10 C6 14 9 16 12 16 C15 16 18 14 18 10 L18 4')
    # Handles
    body += path('M6 6 C4 6 3 8 3 10 C3 12 4 13 6 13')
    body += path('M18 6 C20 6 21 8 21 10 C21 12 20 13 18 13')
    # Base
    body += line(9, 16, 9, 19)
    body += line(15, 16, 15, 19)
    body += line(7, 19, 17, 19)
    save('trophy', body)


def icon_medal():
    """Medal — for rankings. Circle + ribbon."""
    body = circle(12, 10, 6)
    # Star inside
    body += path('M12 6 L13.2 8.5 L16 9 L14 11 L14.5 14 L12 12.5 L9.5 14 L10 11 L8 9 L10.8 8.5 Z')
    # Ribbons
    body += line(8, 15, 6, 21)
    body += line(16, 15, 18, 21)
    save('medal', body)


def icon_medal_gold():
    """Gold medal — #1 position."""
    body = circle(12, 10, 6)
    # "1" inside
    body += path('M11 7.5 L12.5 7 L12.5 13')
    body += line(10.5, 13, 14.5, 13)
    # Ribbons
    body += line(8, 15, 6, 21)
    body += line(16, 15, 18, 21)
    save('medal-gold', body)


def icon_medal_silver():
    """Silver medal — #2 position."""
    body = circle(12, 10, 6)
    # "2" inside
    body += path('M9.5 8.5 C9.5 7 11 6.5 12 6.5 C13 6.5 14.5 7 14.5 8.5 C14.5 10 12 11.5 9.5 13.5 L14.5 13.5')
    body += line(8, 15, 6, 21)
    body += line(16, 15, 18, 21)
    save('medal-silver', body)


def icon_medal_bronze():
    """Bronze medal — #3 position."""
    body = circle(12, 10, 6)
    # "3" inside
    body += path('M9.5 7.5 L14 7.5 L11.5 10 C13 10 14.5 10.5 14.5 12 C14.5 13.5 13 14 12 14 C10.5 14 9.5 13 9.5 12')
    body += line(8, 15, 6, 21)
    body += line(16, 15, 18, 21)
    save('medal-bronze', body)


def icon_star():
    """Star — for highlights, favorites, PBs."""
    body = path('M12 3 L14.4 8.6 L20.5 9.5 L16 14 L17 20 L12 17.2 L7 20 L8 14 L3.5 9.5 L9.6 8.6 Z')
    save('star', body)


def icon_personal_best():
    """Personal best — a star inside a circle. Achievement unlocked."""
    body = circle(12, 12, 9)
    body += path('M12 5.5 L13.6 9.5 L18 10 L14.8 13 L15.5 17.5 L12 15.5 L8.5 17.5 L9.2 13 L6 10 L10.4 9.5 Z')
    save('personal-best', body)


def icon_checkmark_circle():
    """Completion — check inside circle. Session done."""
    body = circle(12, 12, 9)
    body += polyline([(8, 12.5), (11, 15.5), (16, 8.5)])
    save('checkmark-circle', body)


# ─────────────────────────────────────────────
# DAILY SET / EXERCISE KINDS
# ─────────────────────────────────────────────

def icon_calendar():
    """Calendar — for daily set."""
    body = rect(3, 5, 18, 16, 2)
    body += line(3, 10, 21, 10)
    body += line(8, 3, 8, 7)
    body += line(16, 3, 16, 7)
    save('calendar', body)


def icon_kind_confidence():
    """Confidence win — a gentle sun / radiance.
    Warmth, comfort, easy start."""
    body = circle(12, 12, 4)
    # Soft rays — 8 short lines
    for i in range(8):
        a = math.radians(i * 45)
        x1 = 12 + 6 * math.cos(a)
        y1 = 12 + 6 * math.sin(a)
        x2 = 12 + 8 * math.cos(a)
        y2 = 12 + 8 * math.sin(a)
        body += line(round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1))
    save('kind-confidence', body)


def icon_kind_targeted():
    """Targeted practice — crosshair (reuse accuracy concept but distinct).
    Precision, intentional focus on weakness."""
    body = circle(12, 12, 7)
    body += circle(12, 12, 2)
    # Crosshair lines
    body += line(12, 3, 12, 7)
    body += line(12, 17, 12, 21)
    body += line(3, 12, 7, 12)
    body += line(17, 12, 21, 12)
    save('kind-targeted', body)


def icon_kind_challenge():
    """Challenge — a lightning bolt. Energy, push, but clean."""
    body = path('M13 3 L7 13 L11 13 L10 21 L17 11 L13 11 Z')
    save('kind-challenge', body)


def icon_kind_real_life():
    """Real-life scenario — an envelope / message."""
    body = rect(3, 5, 18, 14, 2)
    body += polyline([(3, 5), (12, 13), (21, 5)])
    save('kind-real-life', body)


def icon_kind_mix():
    """Mix / variety — overlapping shapes, diversity."""
    body = circle(9, 10, 5)
    body += rect(11, 9, 9, 9, 2)
    save('kind-mix', body)


# ─────────────────────────────────────────────
# DIFFICULTY
# ─────────────────────────────────────────────

def icon_difficulty(level: int):
    """Difficulty indicator — filled dots out of 5."""
    body = ''
    for i in range(5):
        cx = 3.5 + i * 4.5
        if i < level:
            body += f'  <circle cx="{cx}" cy="12" r="1.8" fill="currentColor" stroke="none" />\n'
        else:
            body += circle(cx, 12, 1.8)
    save(f'difficulty-{level}', body)


# ─────────────────────────────────────────────
# SOUNDSCAPE / AMBIENT
# ─────────────────────────────────────────────

def icon_sound_on():
    """Sound on — speaker with waves."""
    body = path('M6 9 L2 9 L2 15 L6 15 L11 19 L11 5 Z')
    body += path('M14 9.5 C15.5 10.5 15.5 13.5 14 14.5')
    body += path('M16 7 C19 9 19 15 16 17')
    save('sound-on', body)


def icon_sound_off():
    """Sound off / mute — speaker with X."""
    body = path('M6 9 L2 9 L2 15 L6 15 L11 19 L11 5 Z')
    body += line(16, 9, 22, 15)
    body += line(22, 9, 16, 15)
    save('sound-off', body)


def icon_ambient_wave():
    """Ambient / soundscape — gentle sine wave."""
    body = path('M2 12 C4 8 6 8 8 12 C10 16 12 16 14 12 C16 8 18 8 20 12 C22 16 22 16 22 12')
    save('ambient-wave', body)


def icon_ambient_soft():
    """Soft Focus soundscape — smooth low wave."""
    body = path('M2 14 Q7 8 12 12 Q17 16 22 10')
    body += f'  <path d="M2 18 Q7 14 12 16 Q17 18 22 14" opacity="0.4" />\n'
    save('ambient-soft', body)


def icon_ambient_warm():
    """Warm Silence — layered subtle curves."""
    body = path('M3 10 Q8 6 12 10 Q16 14 21 10')
    body += f'  <path d="M3 14 Q8 10 12 14 Q16 18 21 14" opacity="0.5" />\n'
    body += f'  <path d="M3 18 Q8 15 12 18 Q16 21 21 18" opacity="0.25" />\n'
    save('ambient-warm', body)


def icon_ambient_drive():
    """Clean Drive — sharper, more rhythmic."""
    body = path('M2 12 L5 8 L8 16 L11 8 L14 16 L17 8 L20 16 L22 12')
    save('ambient-drive', body)


def icon_ambient_air():
    """Open Air — flowing organic curve, breeze-like."""
    body = path('M2 16 C5 10 8 14 10 10 C12 6 15 14 17 10 C19 6 21 12 22 8')
    body += f'  <path d="M2 20 C6 16 10 18 14 16 C18 14 20 16 22 14" opacity="0.35" />\n'
    save('ambient-air', body)


# ─────────────────────────────────────────────
# MISC / UTILITY
# ─────────────────────────────────────────────

def icon_clock():
    """Clock — for timers, durations."""
    body = circle(12, 12, 9)
    body += line(12, 7, 12, 12)
    body += line(12, 12, 16, 14)
    save('clock', body)


def icon_timer():
    """Timer — for sprint duration."""
    body = circle(12, 13, 8)
    body += line(12, 3, 12, 5)
    body += line(10, 3, 14, 3)
    body += line(12, 9, 12, 13)
    body += line(12, 13, 15, 15)
    save('timer', body)


def icon_eye():
    """Eye — for visibility / show."""
    body = path('M2 12 C5 7 9 5 12 5 C15 5 19 7 22 12 C19 17 15 19 12 19 C9 19 5 17 2 12 Z')
    body += circle(12, 12, 3)
    save('eye', body)


def icon_eye_off():
    """Eye off — hidden."""
    body = path('M4 4 L20 20')
    body += path('M17 17.7 C15.5 18.6 13.8 19 12 19 C9 19 5 17 2 12 C3.5 9.5 5.5 7.5 8 6.3')
    body += path('M10 5.3 C10.6 5.1 11.3 5 12 5 C15 5 19 7 22 12 C21.2 13.4 20 14.7 18.8 15.8')
    save('eye-off', body)


def icon_list():
    """List — for exercise lists."""
    for i, y in enumerate([7, 12, 17]):
        body = '' if i > 0 else ''
        pass
    body = ''
    for y in [7, 12, 17]:
        body += circle(5, y, 1)
        body += line(9, y, 20, y)
    save('list', body)


def icon_grid():
    """Grid layout."""
    body = rect(3, 3, 8, 8, 1.5)
    body += rect(13, 3, 8, 8, 1.5)
    body += rect(3, 13, 8, 8, 1.5)
    body += rect(13, 13, 8, 8, 1.5)
    save('grid', body)


def icon_bar_chart():
    """Bar chart — for progress / stats overview."""
    body = line(4, 20, 20, 20)
    body += rect(5, 12, 3, 8, 0.5)
    body += rect(10.5, 7, 3, 13, 0.5)
    body += rect(16, 4, 3, 16, 0.5)
    save('bar-chart', body)


def icon_trending_up():
    """Trending up — positive progress."""
    body = polyline([(3, 17), (9, 11), (13, 14), (21, 6)])
    body += polyline([(15, 6), (21, 6), (21, 12)])
    save('trending-up', body)


def icon_trending_down():
    """Trending down — for areas needing work."""
    body = polyline([(3, 7), (9, 13), (13, 10), (21, 18)])
    body += polyline([(15, 18), (21, 18), (21, 12)])
    save('trending-down', body)


def icon_hash():
    """Hash / number — for counts."""
    body = line(8, 4, 6, 20)
    body += line(16, 4, 14, 20)
    body += line(4, 9, 20, 9)
    body += line(3, 15, 19, 15)
    save('hash', body)


def icon_zap():
    """Zap / lightning — for quick actions, competitive energy."""
    body = path('M13 3 L7 13 L11 13 L10 21 L17 11 L13 11 Z')
    save('zap', body)


def icon_heart():
    """Heart — for favorites or wellness."""
    body = path('M12 6 C10 3 5 3 5 7 C5 12 12 18 12 18 C12 18 19 12 19 7 C19 3 14 3 12 6 Z')
    save('heart', body)


def icon_bookmark():
    """Bookmark — for saved exercises."""
    body = path('M5 3 L5 21 L12 16 L19 21 L19 3 Z')
    save('bookmark', body)


def icon_filter():
    """Filter — for exercise filtering."""
    body = path('M3 5 L21 5 L14 13 L14 19 L10 21 L10 13 Z')
    save('filter', body)


def icon_search():
    """Search — magnifying glass."""
    body = circle(10, 10, 6)
    body += line(14.5, 14.5, 20, 20)
    save('search', body)


def icon_minus():
    """Minus — for collapse, decrease."""
    body = line(6, 12, 18, 12)
    save('minus', body)


def icon_plus():
    """Plus — for expand, increase."""
    body = line(12, 6, 12, 18)
    body += line(6, 12, 18, 12)
    save('plus', body)


def icon_ghost():
    """Ghost — for ghost run / PB comparison in competitive."""
    body = path('M7 21 L7 10 C7 7.2 9.2 4 12 4 C14.8 4 17 7.2 17 10 L17 21 L15 18 L13 21 L11 18 L9 21 Z')
    body += circle(10, 10, 1)
    body += circle(14, 10, 1)
    save('ghost', body)


# ─────────────────────────────────────────────
# GENERATE ALL
# ─────────────────────────────────────────────

def main():
    print('Generating LoKey Typer icon library...\n')

    print('Brand:')
    icon_logo()
    icon_logo_mark()

    print('\nNavigation:')
    icon_home()
    icon_play()
    icon_play_circle()
    icon_arrow_right()
    icon_arrow_left()
    icon_chevron_right()
    icon_chevron_down()
    icon_external()
    icon_settings()
    icon_refresh()
    icon_x_close()
    icon_check()
    icon_info()
    icon_question()

    print('\nModes:')
    icon_mode_focus()
    icon_mode_real_life()
    icon_mode_competitive()

    print('\nStats:')
    icon_stat_speed()
    icon_stat_accuracy()
    icon_stat_sessions()
    icon_stat_days()
    icon_stat_streak()

    print('\nTyping:')
    icon_cursor()
    icon_keyboard()
    icon_type_text()
    icon_backspace()

    print('\nAchievements:')
    icon_trophy()
    icon_medal()
    icon_medal_gold()
    icon_medal_silver()
    icon_medal_bronze()
    icon_star()
    icon_personal_best()
    icon_checkmark_circle()

    print('\nDaily Set / Kinds:')
    icon_calendar()
    icon_kind_confidence()
    icon_kind_targeted()
    icon_kind_challenge()
    icon_kind_real_life()
    icon_kind_mix()

    print('\nDifficulty:')
    for i in range(1, 6):
        icon_difficulty(i)

    print('\nSoundscape:')
    icon_sound_on()
    icon_sound_off()
    icon_ambient_wave()
    icon_ambient_soft()
    icon_ambient_warm()
    icon_ambient_drive()
    icon_ambient_air()

    print('\nMisc / Utility:')
    icon_clock()
    icon_timer()
    icon_eye()
    icon_eye_off()
    icon_list()
    icon_grid()
    icon_bar_chart()
    icon_trending_up()
    icon_trending_down()
    icon_hash()
    icon_zap()
    icon_heart()
    icon_bookmark()
    icon_filter()
    icon_search()
    icon_minus()
    icon_plus()
    icon_ghost()

    # Count
    icons = [f for f in os.listdir(OUT_DIR) if f.endswith('.svg')]
    print(f'\nDone! {len(icons)} icons generated in {OUT_DIR}')


if __name__ == '__main__':
    main()
