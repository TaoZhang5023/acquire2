// this file was generated by running `yarn generateGameTestFilesSpec` and then formatting this file

import { runGameTestFile } from './runGameTestFile';

describe('game test files', () => {
    describe('play tile', () => {
        it('input validation', () => runGameTestFile('play tile/input validation'));
        it('play HaveNeighboringTileToo tile', () => runGameTestFile('play tile/play HaveNeighboringTileToo tile'));
        it('play WillFormNewChain tile', () => runGameTestFile('play tile/play WillFormNewChain tile'));
        it('play WillPutLonelyTileDown tile', () => runGameTestFile('play tile/play WillPutLonelyTileDown tile'));
    });
    describe('select new chain', () => {
        it('input validation', () => runGameTestFile('select new chain/input validation'));
        it('select first new chain of game', () => runGameTestFile('select new chain/select first new chain of game'));
    });
    describe('start game', () => {
        it('initial tile rack types are correct', () => runGameTestFile('start game/initial tile rack types are correct'));
        it('it works', () => runGameTestFile('start game/it works'));
    });
});
