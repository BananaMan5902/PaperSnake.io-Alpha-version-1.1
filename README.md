
# 🐍 Paper Snake

A browser game that combines the territory-conquering mechanics of Paper.io with the snake combat and growth of Snake.io. Explore a huge world, claim land, outmaneuver CPU opponents, and try to turn the entire map yellow!

## 🎮 Features

- **Huge world:** Explore a 12,000 × 12,000 game world.
- **Territory capture:** Leave your territory, draw a trail, and return to claim new land.
- **Enclosed-area capture:** Land completely enclosed by your territory is captured when you close a loop.
- **CPU opponents:** Battle AI-controlled snakes that explore and compete for territory.
- **CPU respawning:** Eliminated CPUs respawn in unoccupied areas, preferring neutral land.
- **Snake combat:** Colliding with another snake's body can eliminate you or your opponent.
- **Sprint mechanic:** Sprint to move faster, but doing so consumes your snake's length.
- **Solid world boundaries:** The map's edges act as walls rather than instant-kill zones.
- **Live minimap:** See your territory, CPU opponents, and your position across the world.
- **Territory statistics:** Track your captured land, snake length, and kills.
- **Quick restart:** Start a new game after being eliminated.
- **No main menu:** Jump straight into the action.

## 🕹️ Controls

| Key | Action |
| --- | --- |
| W / A / S / D | Move |
| Arrow keys | Move |
| Space | Sprint |
| Shift | Sprint |
| R | Restart after game over |

## 🟨 How to Play

1. Start moving from your yellow territory.
2. Travel outside your territory to create a trail.
3. Return to your existing territory to close the loop.
4. Claim the enclosed neutral land and grow your snake.
5. Avoid colliding with other snakes.
6. Use sprint carefully because it consumes your snake's length.
7. Watch the minimap to see where you are and where your opponents are.
8. Keep expanding until you control the entire world!

## ⚔️ Combat and Territory Rules

- Your trail does not automatically kill other snakes.
- Crossing territory can recolor cells for the snake that enters them.
- Snake-body collisions are the main elimination mechanic.
- Enclosed neutral areas are captured when a trail reconnects to owned territory.
- The map boundary blocks movement.
- CPU snakes attempt to avoid walls and other snakes.

## 🚀 Play Online with GitHub Pages

You can host Paper Snake for free using GitHub Pages.

1. Upload `index.html`, `style.css`, and `game.js` to your repository.
2. Open your repository's **Settings**.
3. Select **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select your main branch and the root (`/`) folder.
6. Save your settings and wait for GitHub Pages to publish the game.
7. Open the published website and start playing!

## 🧰 Built With

- HTML5
- CSS3
- JavaScript
- HTML Canvas API

No additional libraries or installations are required.

## 📁 Project Files

```text
paper-snake/
├── index.html
├── style.css
├── game.js
└── README.md
```

## 🔧 Future Improvements

Potential future features include:

- Smarter CPU opponents
- More CPU snake colors and personalities
- Improved territory and combat effects
- Sound effects and music
- Persistent high scores
- Better mobile controls
- Additional game modes

## 📜 License

This project is available for personal and educational use. Add a license file to your repository if you want to specify formal reuse and distribution terms.

---

**Claim the land. Outsmart the snakes. Paint the world yellow!** 🟨
