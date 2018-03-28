import { GameAction, GameBoardType, GameHistoryMessage, ScoreBoardIndex } from './enums';
import { UserInputError } from './error';
import { ActionBase } from './gameActions/base';
import { ActionStartGame } from './gameActions/startGame';

const initialScoreBoardRow = [0, 0, 0, 0, 0, 0, 0, 60, 60];

export class Game {
    nextTileBagIndex: number = 0;
    tileToTileBagIndex: { [key: number]: number } = {};
    tileRacks: (number | null)[][];
    tileRackTypes: (GameBoardType | null)[][];
    gameBoard: GameBoardType[];
    gameBoardTypeCounts: number[];
    scoreBoard: number[][];
    scoreBoardAvailable: number[] = [25, 25, 25, 25, 25, 25, 25];
    scoreBoardChainSize: number[] = [0, 0, 0, 0, 0, 0, 0];
    scoreBoardPrice: number[] = [0, 0, 0, 0, 0, 0, 0];
    protected currentMoveData: MoveData | null = null;
    moveDataHistory: MoveData[] = [];
    gameActionStack: ActionBase[] = [];
    numTurnsWithoutPlayedTiles: number = 0;

    constructor(public tileBag: number[], public userIDs: number[], starterUserID: number, public myUserID: number | null) {
        // initialize this.tileToTileBagIndex
        for (let tileBagIndex = 0; tileBagIndex < tileBag.length; tileBagIndex++) {
            this.tileToTileBagIndex[tileBag[tileBagIndex]] = tileBagIndex;
        }

        // initialize this.tileRacks
        this.tileRacks = new Array(userIDs.length);
        for (let playerID = 0; playerID < userIDs.length; playerID++) {
            let tileRack = new Array(6);
            for (let i = 0; i < 6; i++) {
                tileRack[i] = null;
            }
            this.tileRacks[playerID] = tileRack;
        }

        // initialize this.tileRackTypes
        this.tileRackTypes = new Array(userIDs.length);
        for (let playerID = 0; playerID < userIDs.length; playerID++) {
            let tileRackTypes = new Array(6);
            for (let i = 0; i < 6; i++) {
                tileRackTypes[i] = null;
            }
            this.tileRackTypes[playerID] = tileRackTypes;
        }

        // initialize this.gameBoard
        this.gameBoard = new Array(108);
        for (let i = 0; i < 108; i++) {
            this.gameBoard[i] = GameBoardType.Nothing;
        }

        // initialize this.gameBoardTypeCounts
        this.gameBoardTypeCounts = new Array(GameBoardType.Max);
        for (let i = 0; i < GameBoardType.Max; i++) {
            this.gameBoardTypeCounts[i] = 0;
        }
        this.gameBoardTypeCounts[GameBoardType.Nothing] = 108;

        // initialize this.scoreBoard
        this.scoreBoard = new Array(userIDs.length);
        for (let playerID = 0; playerID < userIDs.length; playerID++) {
            this.scoreBoard[playerID] = [...initialScoreBoardRow];
        }

        // initialize this.gameActionStack
        this.gameActionStack.push(new ActionStartGame(this, userIDs.indexOf(starterUserID)));
    }

    doGameAction(userID: number, moveIndex: number, parameters: any[]) {
        let playerID = this.userIDs.indexOf(userID);
        let currentAction = this.gameActionStack[this.gameActionStack.length - 1];

        if (playerID !== currentAction.playerID) {
            throw new UserInputError('player cannot play right now');
        }
        if (moveIndex !== this.moveDataHistory.length) {
            throw new UserInputError('incorrect move index');
        }

        let newActions = currentAction.execute(parameters);
        this.getCurrentMoveData().setGameAction(playerID, currentAction.gameAction, parameters);

        while (newActions !== null) {
            this.gameActionStack.pop();
            this.gameActionStack.push(...newActions.reverse());
            currentAction = this.gameActionStack[this.gameActionStack.length - 1];
            newActions = currentAction.prepare();
        }

        this.endCurrentMove();
    }

    drawTiles(playerID: number) {
        let isMe = this.userIDs[playerID] === this.myUserID;

        for (let i = 0; i < 6; i++) {
            if (this.tileRacks[playerID][i] !== null) {
                continue;
            }

            if (this.nextTileBagIndex >= this.tileBag.length) {
                return;
            }
            let tile = this.tileBag[this.nextTileBagIndex++];

            this.tileRacks[playerID][i] = tile;
            this.getCurrentMoveData().addNewPlayerKnownTile(tile, playerID);
            if (isMe) {
                this.getCurrentMoveData().addGameHistoryMessage(new GameHistoryMessageData(GameHistoryMessage.DrewTile, playerID, [tile]));
            }

            if (this.nextTileBagIndex === 108) {
                this.getCurrentMoveData().addGameHistoryMessage(new GameHistoryMessageData(GameHistoryMessage.DrewLastTile, playerID, []));
            }
        }
    }

    removeTile(playerID: number, tileIndex: number) {
        this.tileRacks[playerID][tileIndex] = null;
        this.tileRackTypes[playerID][tileIndex] = null;
    }

    determineTileRackTypesForEverybody() {
        for (let playerID = 0; playerID < this.userIDs.length; playerID++) {
            this.determineTileRackTypesForPlayer(playerID);
        }
    }

    determineTileRackTypesForPlayer(playerID: number) {
        let tileTypes: (GameBoardType | null)[] = [];
        let lonelyTileIndexes: number[] = [];
        let lonelyTileBorderTiles: { [key: number]: boolean } = {};

        let canStartNewChain: boolean = false;
        for (let i = 0; i <= GameBoardType.Imperial; i++) {
            if (this.gameBoardTypeCounts[i] === 0) {
                canStartNewChain = true;
                break;
            }
        }

        for (let tileIndex = 0; tileIndex < 6; tileIndex++) {
            let tile = this.tileRacks[playerID][tileIndex];
            let tileType = null;

            if (tile !== null) {
                let x = Math.floor(tile / 9);
                let y = tile % 9;

                let borderTiles: number[] = [];
                let borderTypes: GameBoardType[] = [];
                if (x > 0) {
                    let neighbor = tile - 9;
                    borderTiles.push(neighbor);
                    borderTypes.push(this.gameBoard[neighbor]);
                }
                if (x < 11) {
                    let neighbor = tile + 9;
                    borderTiles.push(neighbor);
                    borderTypes.push(this.gameBoard[neighbor]);
                }
                if (y > 0) {
                    let neighbor = tile - 1;
                    borderTiles.push(neighbor);
                    borderTypes.push(this.gameBoard[neighbor]);
                }
                if (y < 8) {
                    let neighbor = tile + 1;
                    borderTiles.push(neighbor);
                    borderTypes.push(this.gameBoard[neighbor]);
                }

                borderTypes = borderTypes.filter((type, index) => {
                    if (type === GameBoardType.Nothing || type === GameBoardType.CantPlayEver) {
                        return false;
                    }
                    if (borderTypes.indexOf(type) !== index) {
                        // exclude this as it is already in the array
                        return false;
                    }
                    return true;
                });
                if (borderTypes.length > 1) {
                    borderTypes = borderTypes.filter(type => type !== GameBoardType.NothingYet);
                }

                if (borderTypes.length === 0) {
                    tileType = GameBoardType.WillPutLonelyTileDown;
                    lonelyTileIndexes.push(tileIndex);
                    for (let i = 0; i < borderTiles.length; i++) {
                        lonelyTileBorderTiles[borderTiles[i]] = true;
                    }
                } else if (borderTypes.length === 1) {
                    if (borderTypes.indexOf(GameBoardType.NothingYet) !== -1) {
                        if (canStartNewChain) {
                            tileType = GameBoardType.WillFormNewChain;
                        } else {
                            tileType = GameBoardType.CantPlayNow;
                        }
                    } else {
                        tileType = borderTypes[0];
                    }
                } else {
                    let safeCount = 0;
                    for (let i = 0; i < borderTypes.length; i++) {
                        if (this.gameBoardTypeCounts[borderTypes[i]] >= 11) {
                            safeCount++;
                        }
                    }

                    if (safeCount >= 2) {
                        tileType = GameBoardType.CantPlayEver;
                    } else {
                        tileType = GameBoardType.WillMergeChains;
                    }
                }
            }

            tileTypes.push(tileType);
        }

        if (canStartNewChain) {
            for (let i = 0; i < lonelyTileIndexes.length; i++) {
                let tileIndex = lonelyTileIndexes[i];

                let tileType = tileTypes[tileIndex];
                if (tileType === GameBoardType.WillPutLonelyTileDown) {
                    let tile = this.tileRacks[playerID][tileIndex];
                    if (tile !== null && lonelyTileBorderTiles[tile] === true) {
                        tileTypes[tileIndex] = GameBoardType.HaveNeighboringTileToo;
                    }
                }
            }
        }

        this.tileRackTypes[playerID] = tileTypes;
    }

    setGameBoardPosition(tile: number, gameBoardType: GameBoardType) {
        this.gameBoardTypeCounts[this.gameBoard[tile]]--;
        this.gameBoard[tile] = gameBoardType;
        this.gameBoardTypeCounts[gameBoardType]++;
    }

    getCurrentMoveData() {
        if (this.currentMoveData === null) {
            this.currentMoveData = new MoveData(this);
        }
        return this.currentMoveData;
    }

    endCurrentMove() {
        if (this.currentMoveData !== null) {
            this.currentMoveData.endMove();
            this.moveDataHistory.push(this.currentMoveData);
            this.currentMoveData = null;
        }
    }
}

export class MoveData {
    playerID: number = -1;
    gameAction: GameAction = GameAction.StartGame;
    gameActionParameters: any[] = [];
    newPlayerKnownTiles: number[][];
    newWatcherKnownTiles: number[] = [];
    gameHistoryMessages: GameHistoryMessageData[] = [];
    tileRacks: (number | null)[][];
    tileRackTypes: (GameBoardType | null)[][];
    gameBoard: GameBoardType[] = [];
    scoreBoard: number[][] = [];
    scoreBoardAvailable: number[] = [];
    scoreBoardChainSize: number[] = [];
    scoreBoardPrice: number[] = [];

    constructor(public game: Game) {
        this.newPlayerKnownTiles = new Array(game.userIDs.length);
        for (let playerID = 0; playerID < game.userIDs.length; playerID++) {
            this.newPlayerKnownTiles[playerID] = [];
        }
    }

    setGameAction(playerID: number, gameAction: GameAction, parameters: any[]) {
        this.playerID = playerID;
        this.gameAction = gameAction;
        this.gameActionParameters = parameters;
    }

    addNewPlayerKnownTile(tile: number, playerID: number) {
        this.newPlayerKnownTiles[playerID].push(tile);
    }

    addNewGloballyKnownTile(tile: number, playerIDWhoAlreadyKnows?: number) {
        for (let playerID = 0; playerID < this.newPlayerKnownTiles.length; playerID++) {
            if (playerID !== playerIDWhoAlreadyKnows) {
                this.newPlayerKnownTiles[playerID].push(tile);
            }
        }

        this.newWatcherKnownTiles.push(tile);
    }

    addGameHistoryMessage(gameHistoryMessageData: GameHistoryMessageData) {
        this.gameHistoryMessages.push(gameHistoryMessageData);
    }

    endMove() {
        let clonedTileRacks = new Array(this.game.userIDs.length);
        for (let playerID = 0; playerID < clonedTileRacks.length; playerID++) {
            clonedTileRacks[playerID] = [...this.game.tileRacks[playerID]];
        }
        this.tileRacks = clonedTileRacks;

        let clonedTileRackTypes = new Array(this.game.userIDs.length);
        for (let playerID = 0; playerID < clonedTileRackTypes.length; playerID++) {
            clonedTileRackTypes[playerID] = [...this.game.tileRackTypes[playerID]];
        }
        this.tileRackTypes = clonedTileRackTypes;

        this.gameBoard = [...this.game.gameBoard];

        let clonedScoreBoard = new Array(this.game.userIDs.length);
        for (let playerID = 0; playerID < clonedScoreBoard.length; playerID++) {
            clonedScoreBoard[playerID] = [...this.game.scoreBoard[playerID]];
        }
        this.scoreBoard = clonedScoreBoard;

        this.scoreBoardAvailable = [...this.game.scoreBoardAvailable];
        this.scoreBoardChainSize = [...this.game.scoreBoardChainSize];
        this.scoreBoardPrice = [...this.game.scoreBoardPrice];
    }
}

export class GameHistoryMessageData {
    constructor(public gameHistoryMessage: GameHistoryMessage, public playerID: number | null, public parameters: any[]) {}
}
