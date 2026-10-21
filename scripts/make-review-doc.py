"""Builds "TruthSpin - V1 Handover and Question Review.docx" from content/questions/ and
docs/screenshots/. Run from the project folder:  python scripts/make-review-doc.py
Re-run it after changing questions to get a fresh review list."""

import json
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "TruthSpin - V1 Handover and Question Review.docx"
SHOTS = ROOT / "docs" / "screenshots"
STATS = json.loads((ROOT / "docs" / "stats.json").read_text(encoding="utf-8")) if (ROOT / "docs" / "stats.json").exists() else {}

INK = RGBColor(0x1B, 0x16, 0x38)
INDIGO = RGBColor(0x2B, 0x24, 0x66)
TEAL = RGBColor(0x0F, 0x8F, 0x83)
MUTED = RGBColor(0x5D, 0x56, 0x83)

LEVELS = [
    ("kids", "Kids & Family", "All ages", "Silly, kind and imaginative. Not included: crushes, romance, touching, toilet or body jokes, eating dares, phones, bad words, scary topics."),
    ("friends", "Friends", "13+", "Funny and a little embarrassing, never mean; crushes without names. Not included: kissing, touching, sexual topics, alcohol, exes, posting online, insults about looks. Cards marked “crush” are hidden in Family mode."),
    ("party", "Party", "16+", "Louder and bolder: dating stories, exes, phone dares, noisy group games. Not included: sexual content, undressing, alcohol, risky stunts, contacting anyone outside the game."),
    ("couples", "Couples", "18+", "Two partners. Heat 1 Sweet, heat 2 Hot, heat 3 Very hot (openly sexual, never graphic). Every touch dare asks for the partner’s yes."),
    ("spicy", "Spicy", "18+", "Adult groups. Heat 1 Flirty, heat 2 Hot, heat 3 Very hot (openly sexual, never graphic). Dares with another person always say “a willing player”."),
]
HEAT_NAMES = {"couples": {1: "Sweet", 2: "Hot", 3: "Very hot"}, "spicy": {1: "Flirty", 2: "Hot", 3: "Very hot"}}
TYPE_ORDER = ["truth", "dare", "would-you-rather", "never-have-i-ever", "most-likely-to"]
TYPE_NAMES = {"truth": "Truth", "dare": "Dare", "would-you-rather": "Would you rather", "never-have-i-ever": "Never have I ever", "most-likely-to": "Most likely to"}


# ---------- helpers ----------

def shade(cell, hex_fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc_pr.append(shd)


def repeat_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    tr_pr.append(el)


def no_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:cantSplit")
    el.set(qn("w:val"), "true")
    tr_pr.append(el)


def set_widths(table, widths_cm):
    table.autofit = False
    for row in table.rows:
        for cell, w in zip(row.cells, widths_cm):
            cell.width = Cm(w)


def cell_text(cell, text, bold=False, color=None, size=None, italic=False):
    cell.text = ""
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = color
    if size:
        run.font.size = Pt(size)
    return p


def table(doc, header, rows, widths, font=10, header_fill="2B2466"):
    t = doc.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for c, h in zip(t.rows[0].cells, header):
        cell_text(c, h, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF), size=font)
        shade(c, header_fill)
    repeat_header(t.rows[0])
    for i, r in enumerate(rows):
        cells = t.add_row().cells
        for c, v in zip(cells, r):
            if isinstance(v, tuple):
                cell_text(c, v[0], bold=v[1], size=font)
            else:
                cell_text(c, str(v), size=font)
        if i % 2 == 1:
            for c in cells:
                shade(c, "F3F0FF")
        no_split(t.rows[-1])
    set_widths(t, widths)
    doc.add_paragraph()
    return t


def bullets(doc, items):
    for it in items:
        p = doc.add_paragraph(style="List Bullet")
        if isinstance(it, tuple):
            r = p.add_run(it[0])
            r.bold = True
            p.add_run(it[1])
        else:
            p.add_run(it)


def numbered(doc, items):
    for it in items:
        p = doc.add_paragraph(style="List Number")
        if isinstance(it, tuple):
            r = p.add_run(it[0])
            r.bold = True
            p.add_run(it[1])
        else:
            p.add_run(it)


def para(doc, text, bold_lead=None, italic=False, color=None, size=None):
    p = doc.add_paragraph()
    if bold_lead:
        r = p.add_run(bold_lead)
        r.bold = True
    r = p.add_run(text)
    r.italic = italic
    if color:
        r.font.color.rgb = color
    if size:
        r.font.size = Pt(size)
    return p


# ---------- document ----------

def build():
    doc = Document()
    styles = doc.styles
    styles["Normal"].font.name = "Calibri"
    styles["Normal"].font.size = Pt(11)
    styles["Normal"].font.color.rgb = INK
    styles["Normal"].paragraph_format.space_after = Pt(6)
    for name, size, color in [("Title", 34, INDIGO), ("Heading 1", 20, INDIGO), ("Heading 2", 14, TEAL), ("Heading 3", 12, INDIGO)]:
        st = styles[name]
        st.font.name = "Calibri"
        st.font.size = Pt(size)
        st.font.color.rgb = color
        st.font.bold = True
        st.element.rPr.rFonts.set(qn("w:asciiTheme"), "")  # use Calibri, not the theme font

    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    for m in ("left_margin", "right_margin"):
        setattr(sec, m, Cm(2.2))
    sec.top_margin = sec.bottom_margin = Cm(2)

    footer = sec.footer.paragraphs[0]
    footer.text = "TruthSpin version 1 · handover and question review · 21 October 2026"
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer.runs[0].font.size = Pt(8)
    footer.runs[0].font.color.rgb = MUTED

    # Title page
    doc.add_paragraph()
    t = doc.add_paragraph("TruthSpin", style="Title")
    t.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p = doc.add_paragraph()
    r = p.add_run("Version 1 is built: what it does, what you need to do to launch, and every question to approve")
    r.font.size = Pt(16)
    r.font.color.rgb = TEAL
    r.bold = True
    para(doc, "21 October 2026", color=MUTED)
    if (ROOT / "public" / "og.jpg").exists():
        doc.add_picture(str(ROOT / "public" / "og.jpg"), width=Cm(16.5))
    doc.add_paragraph()
    para(doc, "This document follows the research report “TruthSpin - Research and Game Plan” (19 October 2026). "
              "It shows what was built from your answers, the steps only you can take before launch, and, in Appendix A, "
              "all 810 questions in English and Hinglish for you to read and approve.", color=MUTED)
    doc.add_page_break()

    # 1. Summary
    doc.add_heading("1. Summary", level=1)
    bullets(doc, [
        ("The game is built and tested. ", "It opens straight onto the bottle: tap SPIN, then Truth or Dare. That is two taps to the first question, with no sign-up and no names needed."),
        ("810 questions in English and Hinglish. ", "Kids & Family, Friends and Party have 150 each. Couples and Spicy have 180 each, split into heat levels 1, 2 and 3 as you asked."),
        ("Made for phones first. ", "Checked on 15 screen sizes, from a 280-pixel foldable cover to big phones, phones held sideways, tablets and computers, in both Android’s Chrome and the iPhone browser engine (section 3)."),
        ("It goes live like your other sites. ", "Push it to GitHub and Netlify publishes it. Your Netlify free plan has a monthly credit limit, so publish in batches (section 6)."),
        ("Please read the questions before launch. ", "Most important: the Hinglish lines and the heat-3 cards. Mark anything to change in Appendix A."),
    ])
    para(doc, "The first download is about " + STATS.get("firstLoadKB", "32") + " KB, against the plan’s limit of 150 KB, "
              "so the bottle appears quickly even on a cheap phone with a weak signal. After the first visit, the whole game works offline.")

    # 2. What is built
    doc.add_heading("2. What the game does", level=1)
    doc.add_heading("2.1 Your requests", level=2)
    table(doc, ["You asked for", "What the game does"], [
        (("Bottle ready on the first screen", True), "Opens on the bottle. Tap SPIN, tap the bottle or swipe it. It spins like a real bottle: it starts at the speed of your flick, slows down smoothly over 4 to 6 seconds, stops clearly on one person, and a beam in the level colour shows who was picked."),
        (("Very easy", True), "Two taps to the first question. No sign-up, no names needed, big buttons. Works offline and can be installed on the home screen like an app."),
        (("Defined levels", True), "Kids & Family (all ages), Friends 13+ (the first-time level), Party 16+, Couples 18+ and Spicy 18+. Couples and Spicy each have heat 1, 2 and 3."),
        (("All question types", True), "Truth, Dare and Random. Every 5th turn (you can change this) the whole group plays Would you rather, Never have I ever or Most likely to."),
        (("Skip and next question", True), "Skip gives another question, free and unlimited. Switch turns truth into dare and back. Back shows the previous card. Done ends the turn. No card repeats until a deck is used up, and a counter shows how many new cards are left."),
        (("Players add questions and give feedback", True), "Add your own questions (saved on the phone and mixed into about 1 in 3 cards). Back them up, restore them, or share them with friends as a WhatsApp link. Every card has Like, Dislike and Report. Players can suggest a question to everyone and send feedback, including ideas for new question types. You review everything on a private page."),
        (("A simple name that is easy to search", True), "TruthSpin. The page title starts “TruthSpin: Truth and Dare, Truth or Dare Bottle Game”, so both ways Indians search are covered."),
    ], [5, 11.6])

    doc.add_heading("2.2 Also included", level=2)
    bullets(doc, [
        ("Numbered parts when there are no names: ", "the circle is split into 12 numbered parts (or 6 or 8, or none, in Settings). Everyone takes the number nearest them; the bottle always stops inside one part, never on a line, and that part lights up: “Part 7: truth or dare?”."),
        ("Names around the bottle (optional): ", "2 to 20 names in seating order. The picked name lights up, and fair turns give everyone a go before anyone plays twice."),
        ("Family mode: ", "hides Party, Couples, Spicy and the crush cards, and starts on Kids & Family. Turning it off needs a 2-second press or a 4-digit PIN."),
        ("English or Hinglish in one tap ", "(the EN / HI button on the main screen), for every screen word and every card."),
        ("Sound and buzz: ", "ticks while spinning, a chime when it stops, and a short buzz on Android. The screen stays on while you play."),
        ("Comfort: ", "a gentle spin for people who get dizzy, big text, a light theme, and support for screen readers."),
        ("Sharing: ", "a WhatsApp invite button, and any card can be shared as a picture with a QR code that opens that card."),
        ("Privacy: ", "no account, no ads, no tracking cookies. A plain-English privacy page is included."),
    ])

    doc.add_heading("2.3 Screens", level=2)
    shots = [
        ("01-first-screen.png", "First screen: the bottle is ready"),
        ("15-parts.png", "Numbered parts: the chosen part lights up"),
        ("03-truth-card.png", "A question card"),
        ("06-names.png", "With names: the pick lights up"),
        ("07-levels.png", "Levels, with heat for 18+"),
        ("09-hinglish-card.png", "Hinglish"),
        ("08-kids.png", "Kids & Family bottle"),
        ("10-group-round.png", "Group round"),
        ("14-light-card.png", "Light theme"),
    ]
    shots = [(f, c) for f, c in shots if (SHOTS / f).exists()]
    for i in range(0, len(shots), 3):
        row = shots[i:i + 3]
        t = doc.add_table(rows=2, cols=3)
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for j, (f, cap) in enumerate(row):
            c = t.rows[0].cells[j]
            c.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
            c.paragraphs[0].add_run().add_picture(str(SHOTS / f), width=Cm(4.6))
            cp = cell_text(t.rows[1].cells[j], cap, size=9, color=MUTED)
            cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_paragraph()

    # 3. Phones
    doc.add_heading("3. Made for every phone", level=1).paragraph_format.page_break_before = True
    para(doc, "Most players will use a phone lying in the middle of the group, so every screen was checked on real phone sizes, "
              "in Chrome (Android) and WebKit (the engine of every iPhone browser).")
    for img, cap in [
        ("phones-main.png", "The first screen on a foldable cover, a small Android, an iPhone and a big phone"),
        ("phones-card.png", "The longest Hinglish question: the text grows or shrinks to fill each screen, with no scrolling"),
        ("phones-names.png", "20 players: names sit around the edge in seating order, never overlap, and the bottle points at the chosen name"),
        ("phones-landscape.png", "Phone held sideways: the bottle and the question on the left, the buttons on the right"),
        ("phones-tablet.png", "Tablets and computers: everything one size bigger"),
    ]:
        if (ROOT / "docs" / img).exists():
            doc.add_picture(str(ROOT / "docs" / img), width=Cm(16.4))
            cp = doc.add_paragraph(cap)
            cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
            cp.runs[0].font.size = Pt(9)
            cp.runs[0].font.color.rgb = MUTED
    doc.add_heading("3.1 What a player will notice", level=2)
    bullets(doc, [
        ("Big, readable cards on every screen: ", "the question text is sized to fit the screen, never smaller than 17 pixels, in English and Hinglish, with Big text on or off."),
        ("Buttons for thumbs: ", "every button is at least 40 pixels (most are 44 to 76), and SPIN, Truth, Dare and Done always sit low on the screen, where thumbs reach."),
        ("Any number of players: ", "2 to 20 names fit around the bottle without overlapping, even on a 320-pixel phone; long names are shortened only when space runs out."),
        ("The phone in the middle of the table: ", "a “turn around” button flips the card for the player sitting opposite."),
        ("Sideways and folding phones: ", "a separate layout for phones held sideways, and the right size for foldables (cover screen and open)."),
        ("Typing: ", "when the keyboard opens, the box you type in stays visible and Save is always reachable. Menus can be pulled down to close, and the phone’s Back button closes the top menu instead of leaving the game."),
        ("Cheap phones: ", "the bottle still turns smoothly (about 53 frames a second) with the processor slowed down 6 times, like a low-cost Android."),
        ("Slow networks: ", "the first download is about " + STATS.get("firstLoadKB", "33") + " KB; buttons stay dimmed for the split second until the game can answer them."),
    ])

    # 4. Decisions
    doc.add_heading("4. Your decisions, as built", level=1)
    table(doc, ["#", "Decision", "How it is built"], [
        ("1", "Name: TruthSpin", "Used throughout the game. Buying the domains and the trademark search are still to do (section 6)."),
        ("2", "First level: Friends 13+", "Done. When Family mode is on, the game starts on Kids & Family."),
        ("3", "18+ levels in version 1, age check", "Done. “Is everyone playing 18 or older?” appears when Couples or Spicy is chosen, and again each time the game is opened."),
        ("4", "Spicy included but hidden", "Hidden until someone taps “Show Spicy (18+)” or switches it on in Settings, after the age check."),
        ("5", "English and Hinglish", "Every screen word and every card is in both languages. The Hinglish needs your check (Appendix A)."),
        ("6", "Skip is free", "Free and unlimited by default. “Limited” and “Forfeit” are optional house rules in Settings."),
        ("7", "No money in version 1", "No ads, no payments, nothing locked."),
        ("8", "Feedback tool", "Built for Netlify, where you host: a small Netlify Function saves suggestions, feedback and ratings in Netlify’s built-in storage, and gives you a review page. No IP addresses are stored."),
        ("9", "Visit counts with GoatCounter", "Built, and switched off until you create a free GoatCounter account."),
        ("10", "About 15 minutes a week", "The review page lists suggestions with Approve, Edit and Reject, and shows the most-reported cards first."),
        ("11", "Question style", "Grown from 370 to 810 cards in the same style. Two AI editors then checked every card. Please read them (Appendix A)."),
        ("12", "Accounts in your name", "Your GitHub and Netlify accounts, and the domain in your name. Steps in section 6 and in LAUNCH.md."),
        ("13", "Old files", "Removed. The game was built fresh."),
        ("New", "Heat 1, 2 and 3 in both 18+ levels", "Done. See section 5."),
        ("New", "Hosting on GitHub and Netlify", "Done. Every push to GitHub publishes the game (section 6)."),
        ("New", "Made mainly for phones", "Done and tested on 15 screen sizes in two browser engines (section 3)."),
    ], [1.2, 5, 10.4])

    # 5. Heat levels
    doc.add_heading("5. The 18+ heat levels", level=1)
    para(doc, "Couples and Spicy each have three heat levels. Players choose the level and the heat in the level menu. "
              "The flames next to the level name show which heat is on.")
    counts = STATS.get("heatCounts", {})
    table(doc, ["", "Heat 1", "Heat 2", "Heat 3"], [
        (("Couples (2 partners)", True),
         f"Sweet: romance, memories, compliments, holding hands or a hug after a yes. ({counts.get('couples', {}).get('1', '')} cards)",
         f"Hot: desire and attraction, kissing with a yes, close dancing, massage. ({counts.get('couples', {}).get('2', '')} cards)",
         f"Very hot: frank questions about sex, turn-ons and fantasies, and intimate dares between the partners. ({counts.get('couples', {}).get('3', '')} cards)"),
        (("Spicy (adult groups)", True),
         f"Flirty: attraction, dating stories, crushes, pickup lines. ({counts.get('spicy', {}).get('1', '')} cards)",
         f"Hot: make-out stories, flirty whispers, a slow dance or a cheek kiss with a willing player. ({counts.get('spicy', {}).get('2', '')} cards)",
         f"Very hot: frank questions about sex and fantasies, and dares with a willing player, such as a kiss or a clothed lap dance. ({counts.get('spicy', {}).get('3', '')} cards)"),
    ], [3.4, 4.4, 4.4, 4.4])

    doc.add_heading("5.1 How far heat 3 goes, and why", level=2)
    para(doc, "Heat 3 is openly sexual, as you asked: players talk about sex, turn-ons, fantasies and experiences, and the dares are intimate. "
              "The wording is direct but never graphic: there are no detailed descriptions of sex acts and no crude words. We stopped there for these reasons:")
    bullets(doc, [
        ("India’s IT Act, section 67A, ", "makes publishing sexually explicit material online a crime. Graphic text could put you, the publisher, at risk."),
        ("Google Play and Apple ", "do not allow explicit sexual text, so it would block the Android and iPhone apps planned for phase 3. Ad networks also show no ads on explicit pages."),
        ("Age checks: ", "because the content is bold but not graphic, the one-tap “everyone 18+?” check is enough. Sites with explicit content must check age with ID-level methods in the UK and in several US states."),
    ])
    doc.add_heading("5.2 How the bottle decides where to stop", level=2)
    para(doc, "Before the bottle stops, the game picks the result with the browser’s secure random numbers (the kind used for passwords), then turns the bottle to it. "
              "So nobody can aim: a hard flick only makes it spin longer. With names, everyone plays once (in a new random order each round) before anyone goes again, and nobody is picked twice in a row. "
              "Without names, the circle is split into numbered parts: the bottle always stops inside one part, never on a line, and never on the same part twice in a row (with 12 parts, not on the part next to it either, because one player often sits across two parts). Players can read this in the game under How to play & about.")
    doc.add_heading("5.3 Safety built into the 18+ levels", level=2)
    bullets(doc, [
        "The age question comes back every time the game is opened, because family phones are shared.",
        "Choosing heat 3 asks “Very hot: are you sure?” and says that everyone must be comfortable.",
        "Every touch dare says “if your partner says yes” or “a willing player”. The bottle never decides who kisses whom: the picked player asks a willing player, who can say no.",
        "Undressing is limited to one item of clothing, and underwear always stays on. There are never photos or videos, alcohol, or anyone outside the room.",
        "Skip is always free, and Family mode hides all 18+ levels behind a PIN.",
    ])

    # 6. Launch steps
    doc.add_heading("6. What you need to do to launch", level=1)
    para(doc, "The game goes live the same way as your other sites: push it to GitHub, and Netlify publishes it. "
              "The file LAUNCH.md in the project folder has every step. I can do the GitHub part with you.")
    numbered(doc, [
        ("Approve the questions. ", "Read Appendix A, or ask someone you trust. Mark changes in the OK column or write the new text, and send it back to me (or edit content/questions/ yourself)."),
        ("Buy the domain ", "truthspin.app (and .in or .fun if you want them). About ₹900–1,900 a year. Compare renewal prices, not first-year offers."),
        ("Trademark search in India ", "(IP India public search, classes 9 and 41), or ask a trademark attorney, before you announce the name."),
        ("Push to GitHub and connect Netlify. ", "In Netlify: Add new site, Import from GitHub, pick the repository. The settings fill in by themselves from netlify.toml."),
        ("Set your review-page password ", "in Netlify (Environment variables: ADMIN_PASSWORD), then connect your domain."),
        ("Test with 3 to 5 real groups ", "on real phones (at least one cheap Android and one iPhone) before telling everyone."),
    ])
    doc.add_heading("6.1 Netlify’s free plan: protect your credits", level=2)
    para(doc, "The free plan has 300 credits a month. When they run out, Netlify takes all your sites offline until the next month. What uses credits (Netlify, October 2026):")
    table(doc, ["What", "Credits"], [
        ("Each push to the main branch that publishes the site", "15"),
        ("Players downloading the game (a new player downloads about 0.1–0.2 MB)", "20 per GB"),
        ("Page and function requests", "2 per 10,000"),
        ("Previews of other branches", "Free"),
    ], [12.6, 4])
    bullets(doc, [
        "Publish in batches: work on a separate branch (Netlify builds a free preview you can open on your phone) and merge into main about once a week.",
        "The game already saves credits: ratings are sent in small batches, not one by one, and the game works offline after the first visit.",
        "Check Netlify’s Usage page now and then. If the game takes off (tens of thousands of players a month), move to a paid plan before credits run out.",
    ])
    para(doc, "Timing: the report suggests the Christmas and New Year week (24 December to 1 January) as the first big moment, with weddings and college fests before it. "
              "If the questions are approved by the end of November, there is time to test with groups in early December.")

    # 7. Weekly
    doc.add_heading("7. Every week: your review page", level=1)
    para(doc, "Open truthspin.app/admin and enter your password. (Before the site is live, the same page works on the test server at localhost:5173/admin, password “truthspin”.) It has four tabs:")
    table(doc, ["Tab", "What you do"], [
        (("Suggestions", True), "Approve (edit the text first if needed) or reject each one. Checklist: nothing dangerous, no real names, nothing sexual below 18+, no alcohol or romance in Kids & Family. Rejected suggestions are deleted after 30 days."),
        (("Approved", True), "A ready-made list to copy into the question files, with a Hinglish line added. After you push the update, tap “Mark all as added”."),
        (("Card ratings", True), "Likes, dislikes and reports for every card. Red rows have 3 or more “Too spicy” or “Unsafe” reports: check those first. Rewrite or remove cards that many players dislike."),
        (("Feedback", True), "Messages and ratings from players. Mark them as read."),
    ], [3.4, 13.2])
    para(doc, "Nothing a player writes reaches other players until you approve it and publish an update.")

    # 8. Testing
    doc.add_heading("8. How it was tested", level=1)
    bullets(doc, [
        ("Game logic and server (" + STATS.get("unitTests", "32") + " automatic checks): ", "fair turns, the bottle never stopping near its last stop and always pointing at the chosen name, no repeats until a deck is used up, heat levels kept apart, Family mode hiding crush cards, own questions mixed in about 1 in 3 cards, the filter that refuses phone numbers, emails and links, every question card, and the server: saving ratings, suggestions and feedback, the spam brake, the review-page password, approving, rejecting, and deleting rejected suggestions after 30 days."),
        ("Playing the game (" + STATS.get("e2eTests", "382") + " automatic checks): ", "every screen on 15 screen sizes, in Chrome (Android) and WebKit (iPhone): two taps to the first question, Skip, Switch and Back, swiping, the phone’s Back button, names (2, 8 and 20), the age check and heat 3, Spicy, Family mode, Hinglish, big text, own questions with the keyboard open, Report, group rounds, shared card links, playing offline and the light theme. Every screen is also checked for buttons too small for a thumb, anything cut off at the edge, and card text that does not fit."),
        ("Smoothness: ", "the spin measured with the processor slowed down 4 and 6 times, like a cheap Android phone."),
    ])
    para(doc, "Not tested yet: real Android phones and iPhones in people’s hands, your Netlify site, and real groups of players. Those come with the launch steps above.", italic=True)

    # 9. Limits
    doc.add_heading("9. Known limits and next steps", level=1)
    bullets(doc, [
        ("Hinglish: ", "AI writers wrote it and an AI editor checked it. A native speaker must still read it, because machine-made Hinglish can sound unnatural."),
        ("Hindi in Hindi script ", "is not included yet (phase 2, as planned)."),
        ("Skip and Done counts ", "for each card are not sent yet. The report planned these for a later update. Likes, dislikes and reports are sent."),
        ("iPhone: ", "browsers cannot vibrate, and the silent switch mutes the sound. The game works fully without both."),
        ("The domain ", "is a placeholder (truthspin.app) until you buy it (section 6). The contact email is set: codewithrohitsingh@gmail.com."),
        ("Phase 2 ideas from the report: ", "festival packs (weddings, New Year, Valentine’s, Holi), 300 or more questions per level, Hindi script, and search pages such as “truth and dare questions in Hindi”."),
    ])

    # Appendix A (landscape)
    land = doc.add_section()
    land.orientation = WD_ORIENT.LANDSCAPE
    land.page_width, land.page_height = Cm(29.7), Cm(21)
    land.left_margin = land.right_margin = Cm(1.6)
    land.top_margin = land.bottom_margin = Cm(1.6)

    doc.add_heading("Appendix A. Every question, for your approval", level=1)
    para(doc, "Each row is one card. Read the English and the Hinglish. Tick OK if it is fine, or write the change in the margin. "
              "The ID (for example ft012 = Friends, truth 12) lets us find the card quickly.")
    widths = [1.5, 2.4, 10.6, 10.6, 1.3]
    for key, name, age, rules in LEVELS:
        cards = json.loads((ROOT / "content" / "questions" / f"{key}.json").read_text(encoding="utf-8"))["cards"]
        h = doc.add_heading(f"{name} ({age}): {len(cards)} cards", level=2)
        h.paragraph_format.page_break_before = key != "kids"
        para(doc, rules, color=MUTED, size=10)
        groups = [(None, cards)] if key not in HEAT_NAMES else [(n, [c for c in cards if c.get("heat") == n]) for n in (1, 2, 3)]
        for heat, group in groups:
            if heat:
                doc.add_heading(f"Heat {heat}: {HEAT_NAMES[key][heat]} ({len(group)} cards)", level=3)
            rows = []
            for c in sorted(group, key=lambda c: (TYPE_ORDER.index(c["type"]), c["id"])):
                tags = [t for t in c.get("tags", []) if t in ("crush", "timer")]
                kind = TYPE_NAMES[c["type"]] + (f" · {', '.join(tags)}" if tags else "")
                rows.append((c["id"], kind, c["en"], c.get("hi", ""), "☐"))
            table(doc, ["ID", "Type", "English", "Hinglish", "OK"], rows, widths, font=9)

    doc.save(OUT)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    sys.exit(build())
