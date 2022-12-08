import { IncomingMessage } from "http";
import { WebSocket, WebSocketServer } from "ws";
import LRU from "lru-cache";

type PlayerRole = "BLACK" | "WHITE" | "NONE";
type ChessStatus = "POSITIVE" | "NEGATIVE" | "NONE";

type ChessInfo = {
  position: { x: number; y: number };
  status: ChessStatus;
  belong?: "playerOne" | "playerTwo";
};

type PlayerData = {
  name: string;
  role: PlayerRole;
  chessPieces: ChessInfo[];
  score: number;
};

interface GameData {
  playerOne: PlayerData;
  playerTwo: PlayerData;
}

const checkerboardData: GameData = {
  playerOne: {
    score: 0,
    name: "haha",
    chessPieces: [],
    role: "BLACK",
  },
  playerTwo: {
    score: 0,
    name: "xixi",
    chessPieces: [],
    role: "WHITE",
  },
};

const lru = new LRU({
  max: 500,
  maxSize: 5000,
  ttl: 1000 * 60 * 5,
});

const useWebSocket: (wss: WebSocketServer) => void = (wss: WebSocketServer) => {
  const checkerData = new Map<string, GameData>();
  wss.addListener("connection", (ws: WebSocket, req: IncomingMessage) => {
    ws.send("connected");
    ws.on("message", function message(data: Buffer | BinaryData, isBinary) {
      if (!isBinary) {
        const { payload, action } = JSON.parse(data.toString());

        if (action === "initialize") {
          const id = payload.id;
          if (!checkerData.get(id)) {
            checkerData.set(id, checkerboardData);
          }

          ws.send(
            JSON.stringify({
              action: "initialized",
              payload: checkerData.get(id),
            })
          );
        }
        if (action === "chess") {
          const id = payload.id;
          const chess = payload.chess;
          chess.status = "POSITIVE";
          const myCheckerData = checkerData.get(id);
          if (chess.belong === "playerOne") {
            myCheckerData?.playerOne.chessPieces.push(chess);
          } else {
            myCheckerData?.playerTwo.chessPieces.push(chess);
          }
          ws.send(
            JSON.stringify(
              {
                action: "chess",
                payload: myCheckerData,
              },
              () => {
                lru.set("checkerCache", myCheckerData);
              }
            )
          );
        }
      }

      // boradcast
      wss.clients.forEach(function each(client) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data, { binary: isBinary });
        }
      });
    });
  });
};

export default useWebSocket;
