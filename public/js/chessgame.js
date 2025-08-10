const socket = io()
const chess = new Chess()

const boardElement = document.querySelector(".chessboard")
const nameModal = document.getElementById("nameModal")
const gameOverModal = document.getElementById("gameOverModal")
const playerNameInput = document.getElementById("playerNameInput")
const submitNameBtn = document.getElementById("submitName")
const chatInput = document.getElementById("chatInput")
const sendChatBtn = document.getElementById("sendChatBtn")
const chatMessages = document.getElementById("chatMessages")
const newGameButton = document.getElementById("newGameButton")
const newGameBtn = document.getElementById("newGameBtn")
const closeGameOverBtn = document.getElementById("closeGameOverBtn")

let draggedPiece = null
let sourceSquare = null
let playerRole = null
let playerName = ""
let gameState = {
    lastMove: null,
    capturedPieces: { white: [], black: [] },
    currentPlayer: "w",
    isCheck: false,
    gameEnded: false
}
let timerInterval = null
let currentPlayerId = null

const updatePlayerIdentity = () => {
    const playerIdentityElement = document.getElementById("playerIdentity")
    const playerIdentityTextElement = document.getElementById("playerIdentityText")
    
    playerIdentityElement.classList.remove("identity-white", "identity-black", "identity-spectator")
    
    if (playerRole === 'w') {
        playerIdentityTextElement.textContent = `${playerName} (White Player)`
        playerIdentityElement.classList.add("identity-white")
    } else if (playerRole === 'b') {
        playerIdentityTextElement.textContent = `${playerName} (Black Player)`
        playerIdentityElement.classList.add("identity-black")
    } else {
        playerIdentityTextElement.textContent = `${playerName} (Spectator)`
        playerIdentityElement.classList.add("identity-spectator")
    }
}

const updateTimerDisplay = (timeLeft, player) => {
    const timerElement = document.getElementById(`${player}Timer`)
    const timerBarElement = document.getElementById(`${player}TimerBar`).firstElementChild
    
    const minutes = Math.floor(timeLeft / 60)
    const seconds = timeLeft % 60
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
    
    const percentage = (timeLeft / 60) * 100
    timerBarElement.style.width = `${percentage}%`
    
    if (percentage < 20) {
        timerBarElement.style.background = '#f44336'
    } else if (percentage < 50) {
        timerBarElement.style.background = '#ffeb3b'
    } else {
        timerBarElement.style.background = '#4caf50'
    }
}

const startTimer = (timeLimit, startTime) => {
    if (timerInterval) clearInterval(timerInterval)
    
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const timeLeft = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000))
        
        const currentPlayerColor = gameState.currentPlayer === 'w' ? 'white' : 'black'
        updateTimerDisplay(timeLeft, currentPlayerColor)
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval)
        }
    }, 100)
}

const stopTimer = () => {
    if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
    }
}

submitNameBtn.addEventListener("click", () => {
    const name = playerNameInput.value.trim()
    if (name) {
        playerName = name
        socket.emit("setPlayerName", name)
        nameModal.classList.add("hidden")
    }
})

playerNameInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        submitNameBtn.click()
    }
})

const addChatMessage = (messageData) => {
    const messageElement = document.createElement("div")
    messageElement.classList.add("chat-message")
    
    if (messageData.playerId === currentPlayerId) {
        messageElement.classList.add("own")
    } else {
        messageElement.classList.add("other")
    }
    
    messageElement.innerHTML = `
        <div class="font-semibold text-sm">${messageData.playerName}</div>
        <div>${messageData.message}</div>
        <div class="text-xs text-gray-500">${messageData.timestamp}</div>
    `
    
    chatMessages.appendChild(messageElement)
    chatMessages.scrollTop = chatMessages.scrollHeight
}

sendChatBtn.addEventListener("click", () => {
    const message = chatInput.value.trim()
    if (message) {
        socket.emit("chatMessage", { message })
        chatInput.value = ""
    }
})

chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendChatBtn.click()
    }
})

newGameButton.addEventListener("click", () => {
    socket.emit("newGame")
})

newGameBtn.addEventListener("click", () => {
    socket.emit("newGame")
    gameOverModal.classList.add("hidden")
})

closeGameOverBtn.addEventListener("click", () => {
    gameOverModal.classList.add("hidden")
})

const renderBoard = () => {
    const board = chess.board()
    boardElement.innerHTML = ""
    
    board.forEach((row, rowIndex) => {
        row.forEach((square, squareIndex) => {
            const squareElement = document.createElement("div")
            squareElement.classList.add(
                "square",
                (rowIndex + squareIndex) % 2 === 0 ? "light" : "dark"
            )
            
            squareElement.dataset.row = rowIndex
            squareElement.dataset.col = squareIndex
            
            if (squareIndex === 7 && playerRole !== 'b') {
                const rankCoord = document.createElement("div")
                rankCoord.classList.add("coordinate", "coord-rank")
                rankCoord.textContent = 8 - rowIndex
                squareElement.appendChild(rankCoord)
            }
            
            if (rowIndex === 7 && playerRole !== 'b') {
                const fileCoord = document.createElement("div")
                fileCoord.classList.add("coordinate", "coord-file")
                fileCoord.textContent = String.fromCharCode(97 + squareIndex)
                squareElement.appendChild(fileCoord)
            }
            
            if (gameState.lastMove) {
                const squareNotation = `${String.fromCharCode(97 + squareIndex)}${8 - rowIndex}`
                if (squareNotation === gameState.lastMove.from || squareNotation === gameState.lastMove.to) {
                    squareElement.classList.add("highlight-last-move")
                }
            }
            
            if (gameState.isCheck && square && square.type === 'k' && square.color === gameState.currentPlayer) {
                squareElement.classList.add("highlight-check")
            }
            
            if (square) {
                const pieceElement = document.createElement("div")
                pieceElement.classList.add(
                    "piece",
                    square.color === "w" ? "white" : "black"
                )
                pieceElement.textContent = getPieceUnicode(square)
                pieceElement.draggable = playerRole === square.color && !gameState.gameEnded
                
                if (pieceElement.draggable) {
                    pieceElement.classList.add("draggable")
                }
                
                pieceElement.addEventListener("dragstart", (e) => {
                    if (pieceElement.draggable) {
                        draggedPiece = pieceElement
                        sourceSquare = { row: rowIndex, col: squareIndex }
                        e.dataTransfer.setData("text/plain", "")
                        pieceElement.classList.add("dragging")
                    }
                })
                
                pieceElement.addEventListener("dragend", (e) => {
                    pieceElement.classList.remove("dragging")
                    draggedPiece = null
                    sourceSquare = null
                })
                
                squareElement.appendChild(pieceElement)
            }
            
            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault()
            })
            
            squareElement.addEventListener("drop", (e) => {
                e.preventDefault()
                if (draggedPiece) {
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    }
                    handleMove(sourceSquare, targetSquare)
                }
            })
            
            boardElement.appendChild(squareElement)
        })
    })
    
    if (playerRole === 'b') {
        boardElement.classList.add("flipped")
    } else {
        boardElement.classList.remove("flipped")
    }
}

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q'
    }
    socket.emit("move", move)
}

const getPieceUnicode = (piece) => {
    const unicodePieces = {
        'p': piece.color === 'w' ? '♙' : '♟',
        'r': piece.color === 'w' ? '♖' : '♜',
        'n': piece.color === 'w' ? '♘' : '♞',
        'b': piece.color === 'w' ? '♗' : '♝',
        'q': piece.color === 'w' ? '♕' : '♛',
        'k': piece.color === 'w' ? '♔' : '♚'
    }
    return unicodePieces[piece.type] || ''
}

const updateCapturedPieces = () => {
    const whiteCapturedElement = document.getElementById("whiteCaptured")
    const blackCapturedElement = document.getElementById("blackCaptured")
    
    whiteCapturedElement.innerHTML = ""
    blackCapturedElement.innerHTML = ""
    
    gameState.capturedPieces.white.forEach(piece => {
        const pieceElement = document.createElement("span")
        pieceElement.classList.add("captured-piece")
        pieceElement.textContent = getPieceUnicode({ type: piece.piece, color: piece.color })
        whiteCapturedElement.appendChild(pieceElement)
    })
    
    gameState.capturedPieces.black.forEach(piece => {
        const pieceElement = document.createElement("span")
        pieceElement.classList.add("captured-piece")
        pieceElement.textContent = getPieceUnicode({ type: piece.piece, color: piece.color })
        blackCapturedElement.appendChild(pieceElement)
    })
}

const updateGameStatus = () => {
    const gameStatusElement = document.getElementById("gameStatus")
    const currentTurnIndicator = document.getElementById("currentTurnIndicator")
    const gameInfoElement = document.getElementById("gameInfo")
    
    if (gameState.gameEnded) {
        gameStatusElement.textContent = "Game Over"
        currentTurnIndicator.textContent = ""
        gameInfoElement.textContent = ""
        newGameButton.classList.remove("hidden")
    } else {
        const currentPlayerName = gameState.currentPlayer === 'w' 
            ? document.getElementById("whitePlayerName").textContent 
            : document.getElementById("blackPlayerName").textContent
        
        gameStatusElement.textContent = "Game in Progress"
        currentTurnIndicator.textContent = `${currentPlayerName}'s Turn`
        
        if (gameState.isCheck) {
            gameInfoElement.textContent = "Check!"
            gameInfoElement.className = "text-red-400 text-lg mb-2 font-bold"
        } else {
            gameInfoElement.textContent = ""
        }
        
        newGameButton.classList.add("hidden")
    }
}

const showGameOverModal = (data) => {
    const gameOverContent = document.getElementById("gameOverContent")
    
    let content = ""
    if (data.winner) {
        content = `
            <div class="text-6xl mb-4">🏆</div>
            <h2 class="text-2xl font-bold mb-2 text-gray-800">Game Over!</h2>
            <p class="text-lg text-gray-600 mb-4">${data.winnerName} wins!</p>
            <p class="text-sm text-gray-500">Reason: ${data.reason}</p>
        `
    } else {
        content = `
            <div class="text-6xl mb-4">🤝</div>
            <h2 class="text-2xl font-bold mb-2 text-gray-800">Game Over!</h2>
            <p class="text-lg text-gray-600 mb-4">It's a draw!</p>
            <p class="text-sm text-gray-500">Reason: ${data.reason}</p>
        `
    }
    
    gameOverContent.innerHTML = content
    gameOverModal.classList.remove("hidden")
}

socket.on("playerRole", (role) => {
    playerRole = role
    currentPlayerId = socket.id
    updatePlayerIdentity()
    renderBoard()
})

socket.on("playerAssigned", (data) => {
    const playerNameElement = document.getElementById(`${data.role}PlayerName`)
    playerNameElement.textContent = data.name
})

socket.on("spectatorRole", () => {
    playerRole = null
    currentPlayerId = socket.id
    updatePlayerIdentity()
    renderBoard()
})

socket.on("playersUpdate", (players) => {
    document.getElementById("whitePlayerName").textContent = players.white || "Waiting..."
    document.getElementById("blackPlayerName").textContent = players.black || "Waiting..."
})

socket.on("gameStarted", (players) => {
    document.getElementById("whitePlayerName").textContent = players.white
    document.getElementById("blackPlayerName").textContent = players.black
    updateGameStatus()
})

socket.on("boardState", (fen) => {
    chess.load(fen)
    renderBoard()
})

socket.on("move", (move) => {
    chess.move(move)
    renderBoard()
})

socket.on("gameStateUpdate", (newGameState) => {
    gameState = { ...gameState, ...newGameState }
    updateCapturedPieces()
    updateGameStatus()
    renderBoard()
})

socket.on("timerUpdate", (timerData) => {
    startTimer(timerData.timeLimit, timerData.startTime)
})

socket.on("gameOver", (data) => {
    stopTimer()
    gameState.gameEnded = true
    showGameOverModal(data)
    updateGameStatus()
})

socket.on("gameReset", () => {
    chess.reset()
    gameState = {
        lastMove: null,
        capturedPieces: { white: [], black: [] },
        currentPlayer: "w",
        isCheck: false,
        gameEnded: false
    }
    stopTimer()
    gameOverModal.classList.add("hidden")
    document.getElementById("chatMessages").innerHTML = ""
    updateCapturedPieces()
    updateGameStatus()
    renderBoard()
})

socket.on("chatMessage", (messageData) => {
    addChatMessage(messageData)
})

socket.on("chatHistory", (messages) => {
    messages.forEach(message => {
        addChatMessage(message)
    })
})

socket.on("invalidMove", (move) => {
    console.log("Invalid move attempted:", move)
})

renderBoard()
updateGameStatus()

setTimeout(() => {
    playerNameInput.focus()
}, 100)