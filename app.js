const express = require("express")
const socket = require("socket.io")
const http = require("http")
const {Chess} = require("chess.js")
const path = require("path")

const app = express()

const server = http.createServer(app)
const io = socket(server)

const chess = new Chess();
let players = {}
let gameState = {
    currentPlayer: "w",
    gameStarted: false,
    gameEnded: false,
    winner: null,
    lastMove: null,
    capturedPieces: {
        white: [],
        black: []
    },
    moveTimer: null,
    moveTimeLimit: 60000, // 60 seconds
    currentTurnStartTime: null
}

// Store chat messages
let chatMessages = []

app.set("view engine", "ejs")
app.use(express.static(path.join(__dirname, "public")))

app.get('/', (req, res) => {
    res.render('index', { title: "Enhanced Chess Game" })
})

// Timer function to handle move timeout
const startMoveTimer = () => {
    if (gameState.moveTimer) {
        clearTimeout(gameState.moveTimer)
    }
    
    gameState.currentTurnStartTime = Date.now()
    
    gameState.moveTimer = setTimeout(() => {
        if (!gameState.gameEnded) {
            const currentPlayer = chess.turn()
            const winner = currentPlayer === 'w' ? 'black' : 'white'
            
            gameState.gameEnded = true
            gameState.winner = winner
            
            io.emit("gameOver", {
                winner: winner,
                reason: "timeout",
                winnerName: players[winner]?.name || winner
            })
        }
    }, gameState.moveTimeLimit)
    
    // Emit timer update to all clients
    io.emit("timerUpdate", {
        timeLimit: gameState.moveTimeLimit,
        startTime: gameState.currentTurnStartTime
    })
}

const stopMoveTimer = () => {
    if (gameState.moveTimer) {
        clearTimeout(gameState.moveTimer)
        gameState.moveTimer = null
    }
}

const resetGame = () => {
    chess.reset()
    gameState = {
        currentPlayer: "w",
        gameStarted: false,
        gameEnded: false,
        winner: null,
        lastMove: null,
        capturedPieces: {
            white: [],
            black: []
        },
        moveTimer: null,
        moveTimeLimit: 60000,
        currentTurnStartTime: null
    }
    chatMessages = []
    stopMoveTimer()
}

const getPieceValue = (piece) => {
    const values = {
        'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0
    }
    return values[piece.toLowerCase()] || 0
}

io.on("connection", (uniquesocket) => {
    console.log("New connection:", uniquesocket.id)
    
    // Send current chat messages to new connection
    uniquesocket.emit("chatHistory", chatMessages)
    
    uniquesocket.on("setPlayerName", (name) => {
        if (!players.white) {
            players.white = {
                id: uniquesocket.id,
                name: name
            }
            uniquesocket.emit("playerRole", "w")
            uniquesocket.emit("playerAssigned", { role: "white", name: name })
        } else if (!players.black) {
            players.black = {
                id: uniquesocket.id,
                name: name
            }
            uniquesocket.emit("playerRole", "b")
            uniquesocket.emit("playerAssigned", { role: "black", name: name })
            
            // Both players are now connected, start the game
            gameState.gameStarted = true
            io.emit("gameStarted", {
                white: players.white.name,
                black: players.black.name
            })
            startMoveTimer()
        } else {
            uniquesocket.emit("spectatorRole")
        }
        
        // Broadcast current players to all clients
        io.emit("playersUpdate", {
            white: players.white?.name || null,
            black: players.black?.name || null
        })
    })

    uniquesocket.on("disconnect", () => {
        console.log("Player disconnected:", uniquesocket.id)
        
        let disconnectedPlayer = null
        if (uniquesocket.id === players.white?.id) {
            disconnectedPlayer = "white"
            delete players.white
        } else if (uniquesocket.id === players.black?.id) {
            disconnectedPlayer = "black"
            delete players.black
        }
        
        if (disconnectedPlayer && gameState.gameStarted && !gameState.gameEnded) {
            const remainingPlayer = disconnectedPlayer === "white" ? "black" : "white"
            gameState.gameEnded = true
            gameState.winner = remainingPlayer
            
            io.emit("gameOver", {
                winner: remainingPlayer,
                reason: "disconnect",
                winnerName: players[remainingPlayer]?.name || remainingPlayer
            })
        }
        
        // Reset game if no players left
        if (!players.white && !players.black) {
            resetGame()
        }
        
        io.emit("playersUpdate", {
            white: players.white?.name || null,
            black: players.black?.name || null
        })
        
        stopMoveTimer()
    })

    uniquesocket.on("move", (move) => {
        try {
            if (gameState.gameEnded) return
            
            if (chess.turn() === "w" && uniquesocket.id !== players.white?.id) return
            if (chess.turn() === "b" && uniquesocket.id !== players.black?.id) return

            // Store the piece at the target square before the move (for captures)
            const targetSquare = chess.get(move.to)
            
            const result = chess.move(move)
            if (result) {
                stopMoveTimer()
                
                // Handle captured pieces
                if (targetSquare) {
                    const capturedBy = result.color === 'w' ? 'white' : 'black'
                    gameState.capturedPieces[capturedBy].push({
                        piece: targetSquare.type,
                        color: targetSquare.color,
                        value: getPieceValue(targetSquare.type)
                    })
                }
                
                gameState.lastMove = {
                    from: move.from,
                    to: move.to,
                    piece: result.piece,
                    color: result.color
                }
                
                gameState.currentPlayer = chess.turn()
                
                // Check for game end conditions
                if (chess.isGameOver()) {
                    gameState.gameEnded = true
                    
                    let winner = null
                    let reason = "unknown"
                    
                    if (chess.isCheckmate()) {
                        winner = result.color === 'w' ? 'white' : 'black'
                        reason = "checkmate"
                    } else if (chess.isDraw()) {
                        reason = "draw"
                    }
                    
                    io.emit("gameOver", {
                        winner: winner,
                        reason: reason,
                        winnerName: winner ? players[winner]?.name || winner : null
                    })
                } else {
                    startMoveTimer()
                }
                
                io.emit("move", move)
                io.emit("boardState", chess.fen())
                io.emit("gameStateUpdate", {
                    lastMove: gameState.lastMove,
                    capturedPieces: gameState.capturedPieces,
                    currentPlayer: gameState.currentPlayer,
                    isCheck: chess.inCheck(),
                    gameEnded: gameState.gameEnded
                })
                
            } else {
                console.log("Invalid move:", move)
                uniquesocket.emit("invalidMove", move)
            }
        } catch (error) {
            console.log(error)
            uniquesocket.emit("invalidMove", move)
        }
    })
    
    // Chat functionality
    uniquesocket.on("chatMessage", (data) => {
        const playerName = uniquesocket.id === players.white?.id ? players.white.name :
                          uniquesocket.id === players.black?.id ? players.black.name : "Spectator"
        
        const chatMessage = {
            id: Date.now(),
            playerName: playerName,
            message: data.message.substring(0, 200), // Limit message length
            timestamp: new Date().toLocaleTimeString(),
            playerId: uniquesocket.id
        }
        
        chatMessages.push(chatMessage)
        
        // Keep only last 50 messages
        if (chatMessages.length > 50) {
            chatMessages = chatMessages.slice(-50)
        }
        
        io.emit("chatMessage", chatMessage)
    })
    
    // New game request
    uniquesocket.on("newGame", () => {
        if (uniquesocket.id === players.white?.id || uniquesocket.id === players.black?.id) {
            resetGame()
            io.emit("gameReset")
            
            if (players.white && players.black) {
                gameState.gameStarted = true
                io.emit("gameStarted", {
                    white: players.white.name,
                    black: players.black.name
                })
                startMoveTimer()
            }
        }
    })
    
    // Send current game state to new connections
    uniquesocket.emit("gameStateUpdate", {
        lastMove: gameState.lastMove,
        capturedPieces: gameState.capturedPieces,
        currentPlayer: gameState.currentPlayer,
        isCheck: chess.inCheck(),
        gameEnded: gameState.gameEnded
    })
    
    uniquesocket.emit("boardState", chess.fen())
})

server.listen(3000, () => {
    console.log("Enhanced Chess Game running on Port 3000")
})