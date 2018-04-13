import './global.css';

import { List } from 'immutable';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { defaultMoveDataHistory } from '../defaults';
import { GameBoardType, GameHistoryMessage } from '../enums';
import { Game } from '../game';
import { getNewTileBag } from '../helpers';
import { runGameTestFile } from '../runGameTestFile';
import { GameBoard, GameBoardProps } from './components/GameBoard';
import { GameHistory, GameHistoryProps } from './components/GameHistory';
import { ScoreBoard, ScoreBoardProps } from './components/ScoreBoard';
import { TileRack, TileRackProps } from './components/TileRack';
import { GameBoardLabelMode } from './enums';
import { getTileString } from './helpers';

async function main() {
    const props = new AllDemoProps();
    render(props);
}

function onTileClicked(tile: number) {
    console.log('onTileClicked:', getTileString(tile));
}

class AllDemoProps {
    gameBoardProps1: GameBoardProps = {
        gameBoard: List([
            ...[0, 7, 7, 7, 7, 7, 7, 7, 7],
            ...[0, 7, 7, 7, 7, 7, 7, 7, 7],
            ...[7, 8, 7, 7, 7, 7, 8, 7, 7],
            ...[1, 7, 8, 7, 7, 7, 7, 7, 7],
            ...[1, 7, 7, 7, 7, 7, 7, 7, 7],
            ...[7, 7, 7, 7, 5, 7, 7, 8, 7],
            ...[2, 7, 7, 7, 5, 5, 5, 7, 7],
            ...[2, 7, 8, 7, 5, 5, 7, 7, 7],
            ...[7, 7, 7, 7, 5, 9, 6, 6, 6],
            ...[3, 7, 7, 7, 5, 7, 6, 6, 6],
            ...[3, 7, 7, 7, 5, 9, 6, 6, 6],
            ...[7, 4, 4, 7, 5, 5, 9, 6, 6],
        ]),
        tileRack: List([8, 86, null, 40, 99, 12]),
        labelMode: GameBoardLabelMode.Coordinates,
        cellSize: 40,
        onCellClicked: onTileClicked,
    };

    gameBoardProps2: GameBoardProps = { ...this.gameBoardProps1, labelMode: GameBoardLabelMode.HotelInitials };

    gameBoardProps3: GameBoardProps = { ...this.gameBoardProps1, labelMode: GameBoardLabelMode.Nothing };

    scoreBoardProps1: ScoreBoardProps = {
        usernames: ['winning player', 'losing player'],
        scoreBoard: List<List<number>>([List([6, 1, 13, 10, 4, 4, 6, 207, 785]), List([1, 0, 11, 0, 3, 1, 1, 256, 533])]),
        scoreBoardAvailable: List<number>([18, 24, 1, 15, 18, 20, 18]),
        scoreBoardChainSize: List<number>([3, 0, 39, 5, 2, 4, 13]),
        scoreBoardPrice: List<number>([3, 0, 10, 6, 3, 6, 9]),
        turnPlayerID: 1,
        movePlayerID: 0,
        isTeamGame: false,
        cellWidth: 30,
    };

    scoreBoardProps2: ScoreBoardProps = {
        usernames: ['tlstyer', 'REALLY LONG NAME', 'Somebody Else', 'hi!'],
        scoreBoard: List<List<number>>([
            List([4, 0, 0, 0, 0, 0, 0, 74, 82]),
            List([0, 4, 0, 0, 0, 0, 0, 74, 82]),
            List([0, 0, 0, 0, 0, 4, 0, 88, 104]),
            List([1, 1, 0, 0, 0, 1, 1, 92, 228]),
        ]),
        scoreBoardAvailable: List<number>([20, 20, 25, 25, 25, 20, 24]),
        scoreBoardChainSize: List<number>([2, 2, 0, 0, 0, 2, 9]),
        scoreBoardPrice: List<number>([2, 2, 0, 0, 0, 4, 8]),
        turnPlayerID: 0,
        movePlayerID: 0,
        isTeamGame: false,
        cellWidth: 30,
    };

    scoreBoardProps3: ScoreBoardProps = {
        usernames: ['player 1', 'player 2', 'player 3', 'player 4'],
        scoreBoard: List<List<number>>([
            List([0, 0, 5, 9, 0, 13, 0, 0, 427]),
            List([8, 1, 0, 13, 0, 12, 0, 63, 474]),
            List([7, 1, 11, 0, 0, 0, 0, 107, 212]),
            List([1, 3, 9, 3, 0, 0, 0, 213, 310]),
        ]),
        scoreBoardAvailable: List<number>([9, 20, 0, 0, 25, 0, 25]),
        scoreBoardChainSize: List<number>([0, 0, 4, 27, 0, 42, 0]),
        scoreBoardPrice: List<number>([0, 0, 5, 9, 0, 12, 0]),
        turnPlayerID: -1,
        movePlayerID: -1,
        isTeamGame: true,
        cellWidth: 30,
    };

    tileRackProps1: TileRackProps = {
        tiles: List([1, 28, 55, 82, 92, 40]),
        types: List([
            GameBoardType.Luxor,
            GameBoardType.Tower,
            GameBoardType.American,
            GameBoardType.Festival,
            GameBoardType.Worldwide,
            GameBoardType.Continental,
        ]),
        buttonSize: 40,
        onTileClicked: onTileClicked,
    };

    tileRackProps2: TileRackProps = {
        tiles: List([71, null, 99, 12, 8, 17]),
        types: List([
            GameBoardType.Imperial,
            null,
            GameBoardType.WillMergeChains,
            GameBoardType.WillPutLonelyTileDown,
            GameBoardType.HaveNeighboringTileToo,
            GameBoardType.HaveNeighboringTileToo,
        ]),
        buttonSize: 40,
        onTileClicked: onTileClicked,
    };

    tileRackProps3: TileRackProps = {
        tiles: List([null, 86, null, 38, null, 74]),
        types: List([null, GameBoardType.CantPlayEver, null, GameBoardType.WillFormNewChain, null, GameBoardType.CantPlayNow]),
        buttonSize: 40,
        onTileClicked: onTileClicked,
    };

    gameHistoryProps1: GameHistoryProps;
    gameHistoryProps2: GameHistoryProps;
    gameHistoryProps3: GameHistoryProps;

    constructor() {
        const game1 = AllDemoProps.getDummyGameForGetGameHistory();
        this.gameHistoryProps1 = {
            usernames: ['Tim', 'Rita', 'Dad', 'Mom'],
            moveDataHistory: game1.moveDataHistory,
        };

        const { game: game2 } = runGameTestFile(require('raw-loader!../gameTestFiles/other/all tiles played').split('\n'));
        this.gameHistoryProps2 = {
            usernames: ['A User', 'Somebody Else'],
            moveDataHistory: game2 !== null ? game2.moveDataHistory : defaultMoveDataHistory,
        };

        const { game: game3 } = runGameTestFile(require('raw-loader!../gameTestFiles/other/no tiles played for entire round').split('\n'));
        this.gameHistoryProps3 = {
            usernames: ['player 1', 'player 2'],
            moveDataHistory: game3 !== null ? game3.moveDataHistory : defaultMoveDataHistory,
        };
    }

    static getDummyGameForGetGameHistory() {
        const game = new Game(getNewTileBag(), [2, 3, 5, 8], 8, 3);
        game.doGameAction(8, 0, []);
        game.moveDataHistory = defaultMoveDataHistory;

        let moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.TurnBegan, 0, []);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.DrewPositionTile, 1, [21]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.StartedGame, 2, []);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.DrewTile, 3, [100]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.HasNoPlayableTile, 0, []);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.PlayedTile, 1, [40]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.FormedChain, 2, [0]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.MergedChains, 3, [[1, 2]]);
        moveData.addGameHistoryMessage(GameHistoryMessage.MergedChains, 0, [[3, 4, 5]]);
        moveData.addGameHistoryMessage(GameHistoryMessage.MergedChains, 1, [[0, 1, 2, 6]]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.SelectedMergerSurvivor, 2, [3]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.SelectedChainToDisposeOfNext, 3, [4]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.ReceivedBonus, 0, [5, 25]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.DisposedOfShares, 1, [6, 2, 3]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.CouldNotAffordAnyShares, 2, []);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.PurchasedShares, 3, [[]]);
        moveData.addGameHistoryMessage(GameHistoryMessage.PurchasedShares, 0, [[[0, 3]]]);
        moveData.addGameHistoryMessage(GameHistoryMessage.PurchasedShares, 1, [[[1, 2], [2, 1]]]);
        moveData.addGameHistoryMessage(GameHistoryMessage.PurchasedShares, 2, [[[3, 1], [4, 1], [5, 1]]]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.DrewLastTile, 3, []);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.ReplacedDeadTile, 0, [30]);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.EndedGame, 1, []);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.NoTilesPlayedForEntireRound, null, []);
        game.endCurrentMove();

        moveData = game.getCurrentMoveData();
        moveData.addGameHistoryMessage(GameHistoryMessage.AllTilesPlayed, null, []);
        game.endCurrentMove();

        return game;
    }
}

function render(props: AllDemoProps) {
    ReactDOM.render(
        <div>
            <h1>GameBoard</h1>
            <h2>labelMode=Coordinates</h2>
            <GameBoard {...props.gameBoardProps1} />
            <h2>labelMode=HotelInitials</h2>
            <GameBoard {...props.gameBoardProps2} />
            <h2>labelMode=Nothing</h2>
            <GameBoard {...props.gameBoardProps3} />

            <h1>ScoreBoard</h1>
            <ScoreBoard {...props.scoreBoardProps1} />
            <br />
            <ScoreBoard {...props.scoreBoardProps2} />
            <br />
            <ScoreBoard {...props.scoreBoardProps3} />

            <h1>TileRack</h1>
            <TileRack {...props.tileRackProps1} />
            <br />
            <TileRack {...props.tileRackProps2} />
            <br />
            <TileRack {...props.tileRackProps3} />

            <h1>GameHistory</h1>
            <GameHistory {...props.gameHistoryProps1} />
            <br />
            <GameHistory {...props.gameHistoryProps2} />
            <br />
            <GameHistory {...props.gameHistoryProps3} />
        </div>,
        document.getElementById('root'),
    );
}

main();