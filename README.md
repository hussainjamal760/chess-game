# ♟️ Enhanced Chess Game

A real-time chess game built with **Node.js**, **Express**, **Socket.IO**, and **EJS**.  
Play online with friends in your browser — fast, simple, and fun.

---

## 🚀 Features
- ♟ Real-time moves with WebSockets
- ✅ Legal move validation using chess.js
- 🏆 Winner announcement at game end
- 🖥 Responsive, clean UI
- 🙋 Player name prompt on join

---

## 🛠 Tech Stack
- **Backend:** Node.js, Express
- **Frontend:** HTML, CSS, JavaScript, EJS
- **Realtime:** Socket.IO
- **Game Logic:** chess.js

---

## 📂 Folder Structure
```

/public
/js
chessgame.js        # Client-side game logic
/views
index.ejs             # Game board UI
app.js                  # Server + socket.io setup
package.json            # Dependencies

````

---

## 🔧 Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/chess-game.git
cd chess-game

# Install dependencies
npm install

# Run locally
npm start
````

Visit https://chess-game-gebt.onrender.com/ in your browser.

---

## 🌍 Deployment

This project can be deployed to:

* [Render](https://render.com/)
* [Heroku](https://www.heroku.com/)
* [Vercel](https://vercel.com/)

Make sure `app.js` uses:

```js
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
```

---

## 🎯 How to Play

1. Open the game in two browsers/devices.
2. Enter your name when asked.
3. White moves first, then alternate turns.
4. Winner is announced automatically.

---

## 📜 License

MIT License — feel free to use, modify, and share.

---

## 👤 Author

**Hussain Jamal**
📧 [hussainjamal760@gmail.com](mailto:hussainjamal760@gmail.com)

```
