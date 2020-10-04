import { GameActionEnum, GameHistoryMessageEnum } from '../enums';
import { UserInputError } from '../error';
import { Game } from '../game';
import { neighboringTilesLookup } from '../helpers';
import { GameBoardType } from '../pb';
import { ActionBase } from './base';
import { ActionSelectMergerSurvivor } from './selectMergerSurvivor';
import { ActionSelectNewChain } from './selectNewChain';

export class ActionPlayTile extends ActionBase {
  constructor(game: Game, playerID: number) {
    super(game, playerID, GameActionEnum.PlayTile);
  }

  prepare() {
    const moveData = this.game.getCurrentMoveData();

    this.game.turnPlayerID = this.playerID;

    moveData.addGameHistoryMessage(GameHistoryMessageEnum.TurnBegan, this.playerID, []);

    let hasAPlayableTile = false;
    if (this.playerID === this.game.playerIDWithPlayableTile) {
      hasAPlayableTile = true;
    } else {
      const tileRackTypes = this.game.tileRackTypes.get(this.playerID)!;
      for (let i = 0; i < 6; i++) {
        const tileType = tileRackTypes.get(i, null);
        if (tileType !== null && tileType !== GameBoardType.CANT_PLAY_NOW && tileType !== GameBoardType.CANT_PLAY_EVER) {
          hasAPlayableTile = true;
          break;
        }
      }
    }

    if (hasAPlayableTile) {
      this.game.numTurnsWithoutPlayedTiles = 0;
      return null;
    } else {
      this.game.numTurnsWithoutPlayedTiles++;
      moveData.addGameHistoryMessage(GameHistoryMessageEnum.HasNoPlayableTile, this.playerID, []);
      return [];
    }
  }

  execute(parameters: any[]) {
    if (parameters.length !== 1) {
      throw new UserInputError('did not get exactly 1 parameter');
    }
    const tile: number = parameters[0];
    if (!Number.isInteger(tile) || tile < 0 || tile >= 108) {
      throw new UserInputError('parameter is not a valid tile');
    }
    const tileRackIndex = this.game.tileRacks.get(this.playerID)!.indexOf(tile);
    if (tileRackIndex === -1) {
      throw new UserInputError('player does not have given tile');
    }
    const tileType = this.game.tileRackTypes.get(this.playerID)!.get(tileRackIndex, null);

    let response: ActionBase[] = [];
    if (tileType !== null && tileType <= GameBoardType.IMPERIAL) {
      this.game.fillCells(tile, tileType);
      this.game.setChainSize(tileType, this.game.gameBoardTypeCounts[tileType]);
    } else if (tileType === GameBoardType.WILL_PUT_LONELY_TILE_DOWN || tileType === GameBoardType.HAVE_NEIGHBORING_TILE_TOO) {
      this.game.setGameBoardPosition(tile, GameBoardType.NOTHING_YET);
    } else if (tileType === GameBoardType.WILL_FORM_NEW_CHAIN) {
      const availableChains: GameBoardType[] = [];
      const scoreBoardChainSize = this.game.scoreBoardChainSize;
      for (let type = 0; type < scoreBoardChainSize.size; type++) {
        if (scoreBoardChainSize.get(type)! === 0) {
          availableChains.push(type);
        }
      }
      response = [new ActionSelectNewChain(this.game, this.playerID, availableChains, tile)];
    } else if (tileType === GameBoardType.WILL_MERGE_CHAINS) {
      response = [new ActionSelectMergerSurvivor(this.game, this.playerID, this.getMergedChains(tile), tile)];
    } else {
      throw new UserInputError('cannot play given tile');
    }

    this.game.removeTile(this.playerID, tileRackIndex);

    this.game.getCurrentMoveData().addGameHistoryMessage(GameHistoryMessageEnum.PlayedTile, this.playerID, [tile]);

    return response;
  }

  protected getMergedChains(tile: number) {
    const chains: GameBoardType[] = [];
    const neighboringTiles = neighboringTilesLookup[tile];
    for (let i = 0; i < neighboringTiles.length; i++) {
      const neighboringTile = neighboringTiles[i];
      const type = this.game.gameBoard.get(neighboringTile % 9)!.get(neighboringTile / 9)!;
      if (type <= GameBoardType.IMPERIAL && chains.indexOf(type) === -1) {
        chains.push(type);
      }
    }

    chains.sort((a, b) => a - b);

    return chains;
  }
}
