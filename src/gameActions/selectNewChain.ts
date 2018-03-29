import { ActionBase } from './base';
import { GameAction, GameBoardType, GameHistoryMessage, ScoreBoardIndex } from '../enums';
import { UserInputError } from '../error';
import { Game, GameHistoryMessageData } from '../game';

export class ActionSelectNewChain extends ActionBase {
    constructor(game: Game, playerID: number, public availableChains: GameBoardType[], public tile: number) {
        super(game, playerID, GameAction.SelectNewChain);

        this.parameters.push(availableChains, tile);
    }

    prepare() {
        if (this.availableChains.length === 1) {
            this.createNewChain(this.availableChains[0]);
            return [];
        } else {
            this.game.setGameBoardPosition(this.tile, GameBoardType.NothingYet);
            this.game.determineTileRackTypesForEverybody();
            return null;
        }
    }

    execute(parameters: any[]) {
        if (parameters.length !== 1) {
            throw new UserInputError('did not get exactly 1 parameter');
        }
        const chain: number = parameters[0];
        if (!Number.isInteger(chain)) {
            throw new UserInputError('parameter is not an integer');
        }
        if (this.availableChains.indexOf(chain) === -1) {
            throw new UserInputError('selected chain cannot be formed');
        }

        this.createNewChain(chain);
        return [];
    }

    protected createNewChain(chain: GameBoardType) {
        // @ts-ignore
        let scoreBoardIndex: ScoreBoardIndex = chain;

        this.game.fillCells(this.tile, chain);
        this.game.setChainSize(scoreBoardIndex, this.game.gameBoardTypeCounts[chain]);
        if (this.game.scoreBoardAvailable.get(scoreBoardIndex, 0) > 0) {
            this.game.adjustPlayerScoreBoardRow(this.playerID, [[scoreBoardIndex, 1]]);
        }

        this.game.getCurrentMoveData().addGameHistoryMessage(new GameHistoryMessageData(GameHistoryMessage.FormedChain, this.playerID, [chain]));
    }
}
