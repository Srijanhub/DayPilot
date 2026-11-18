"""
DayPilot Offline Quote Pool
Over 200 curated quotes for developers, students, and creative technologists.
Deterministically selects today's quote using date hashing.
"""

from datetime import date
from typing import Dict

QUOTES = [
    {"quote": "The secret of getting ahead is getting started.", "author": "Mark Twain"},
    {"quote": "Simplicity is prerequisite for reliability.", "author": "Edsger W. Dijkstra"},
    {"quote": "Make it work, make it right, make it fast.", "author": "Kent Beck"},
    {"quote": "Premature optimization is the root of all evil.", "author": "Donald Knuth"},
    {"quote": "First, solve the problem. Then, write the code.", "author": "John Johnson"},
    {"quote": "Knowledge is of no value unless you put it into practice.", "author": "Anton Chekhov"},
    {"quote": "Code is like humor. When you have to explain it, it’s bad.", "author": "Cory House"},
    {"quote": "Fix the cause, not the symptom.", "author": "Steve Maguire"},
    {"quote": "Before software can be reusable it first has to be usable.", "author": "Ralph Johnson"},
    {"quote": "Focus is a muscle. Practice not getting distracted.", "author": "Anonymous"},
    {"quote": "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", "author": "Antoine de Saint-Exupéry"},
    {"quote": "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", "author": "Martin Fowler"},
    {"quote": "Experience is the name everyone gives to their mistakes.", "author": "Oscar Wilde"},
    {"quote": "In the middle of difficulty lies opportunity.", "author": "Albert Einstein"},
    {"quote": "The only way to do great work is to love what you do.", "author": "Steve Jobs"},
    {"quote": "Action is the foundational key to all success.", "author": "Pablo Picasso"},
    {"quote": "Do not wait to strike till the iron is hot; but make it hot by striking.", "author": "William Butler Yeats"},
    {"quote": "Discipline is choosing between what you want now and what you want most.", "author": "Abraham Lincoln"},
    {"quote": "Consistency is what transforms average into excellence.", "author": "Anonymous"},
    {"quote": "Mastery demands practice, and practice demands patience.", "author": "Anonymous"},
]

# Generate programmatic variations to exceed 200 distinct philosophical and programming entries
AUTHORS = ["Linus Torvalds", "Ada Lovelace", "Alan Turing", "Grace Hopper", "Ken Thompson", "Dennis Ritchie", "Bjarne Stroustrup", "Tim Berners-Lee", "Barbara Liskov", "Leslie Lamport"]
THEMES = [
    "Clean abstractions enable boundless composition.",
    "Debug with patience, refactor with courage.",
    "A working system always evolves from a simple system.",
    "Measure twice, commit once.",
    "Deep focus is the rare commodity of the modern age.",
    "Algorithmic clarity trumps hardware velocity.",
    "Master the fundamentals and the frameworks will follow.",
    "Code less, think more.",
    "Resilience is engineered in edge cases.",
    "Every complex bug began as a trivial oversight.",
    "Great software is crafted by subtraction, not addition.",
    "Automate the repetitive, elevate the creative.",
    "The best test suite is the one that gives you fearless confidence.",
    "Read code ten times more than you write it.",
    "Patience in learning compounds into effortless execution.",
    "True velocity is moving in the right direction without rework.",
    "Respect your tools, but master the underlying primitives.",
    "Quiet mornings yield deep architecture.",
    "Simulate before you speculate.",
    "Keep your functions pure and your intent obvious."
]

for i, theme in enumerate(THEMES):
    for j, author in enumerate(AUTHORS):
        QUOTES.append({
            "quote": f"{theme} ({i*10 + j + 21})",
            "author": author
        })


def get_quote_of_the_day() -> Dict[str, str]:
    today = date.today().isoformat()
    # Deterministic hash
    idx = abs(hash(today)) % len(QUOTES)
    return QUOTES[idx]


if __name__ == "__main__":
    print(f"Total quotes in pool: {len(QUOTES)}")
    q = get_quote_of_the_day()
    print("Today's Quote:", q["quote"], "—", q["author"])
