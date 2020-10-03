import { List } from 'immutable';
import * as SockJS from 'sockjs-client';
import { ErrorCode, GameAction, GameSetupChange, MessageToClient, MessageToServer } from '../common/enums';
import { GameMode, PlayerArrangementMode } from '../common/pb';
import { Client, ClientManager, ClientManagerPage, GameData, User } from './clientManager';

jest.mock('sockjs-client');

// @ts-ignore
const mockSockJS: jest.Mock = SockJS;

class TestConnection {
  onopen: ((e: any) => any) | null = null;
  onmessage: ((e: any) => any) | null = null;
  onclose: ((e: any) => any) | null = null;

  readyState = WebSocket.CLOSED;

  sentMessages: any[] = [];

  send(data: string) {
    this.sentMessages.push(JSON.parse(data));
  }

  triggerOpen() {
    if (this.onopen) {
      this.readyState = WebSocket.OPEN;
      this.onopen({});
    }
  }

  triggerMessage(message: any) {
    if (this.onmessage) {
      if (typeof message !== 'string') {
        message = JSON.stringify(message);
      }
      this.onmessage({ data: message });
    }
  }

  triggerClose() {
    if (this.onclose) {
      this.readyState = WebSocket.CLOSED;
      this.onclose({});
    }
  }

  clearSentMessages() {
    this.sentMessages = [];
  }
}

function getClientManagerAndStuff() {
  const clientManager = new ClientManager();
  const testConnection = new TestConnection();

  const renderMock = jest.fn();
  clientManager.render = renderMock;

  mockSockJS.mockReset();
  mockSockJS.mockImplementation(() => testConnection);

  clientManager.manage();

  return { clientManager, testConnection, renderMock };
}

class ClientData {
  constructor(public clientID: number, public gameID?: number) {}
}

class UserData {
  constructor(public userID: number, public username: string, public clientDatas: ClientData[]) {}
}

class GameDataData {
  constructor(public gameID: number, public gameDisplayNumber: number, public userIDs: number[]) {}
}

// UCR = Un-Circular-Reference-ified

class UCRClient {
  constructor(public clientID: number, public gameID: number | null, public userID: number) {}
}

class UCRUser {
  constructor(public userID: number, public username: string, public clientIDs: Set<number>, public numGames: number) {}
}

class UCRGameData {
  clientIDs = new Set<number>();

  constructor(public gameID: number, public gameDisplayNumber: number, public userIDs: Set<number>) {}
}

type ClientIDToUCRClient = Map<number, UCRClient>;
type UserIDToUCRUser = Map<number, UCRUser>;
type GameIDTOUCRGameData = Map<number, UCRGameData>;

function expectClientAndUserAndGameData(clientManager: ClientManager, userDatas: UserData[], gameDataDatas: GameDataData[]) {
  const clientIDToUCRClient: ClientIDToUCRClient = new Map();
  const userIDToUCRUser: UserIDToUCRUser = new Map();
  const gameIDTOUCRGameData: GameIDTOUCRGameData = new Map();
  const gameDisplayNumberTOUCRGameData: GameIDTOUCRGameData = new Map();

  gameDataDatas.forEach((gameDataData) => {
    const ucrGameData = new UCRGameData(gameDataData.gameID, gameDataData.gameDisplayNumber, new Set(gameDataData.userIDs));

    gameIDTOUCRGameData.set(gameDataData.gameID, ucrGameData);
    gameDisplayNumberTOUCRGameData.set(gameDataData.gameDisplayNumber, ucrGameData);
  });

  userDatas.forEach((userData) => {
    const clientIDs = new Set<number>();

    userData.clientDatas.forEach((clientData) => {
      const gameID = clientData.gameID !== undefined ? clientData.gameID : null;

      clientIDToUCRClient.set(clientData.clientID, new UCRClient(clientData.clientID, gameID, userData.userID));
      if (clientData.gameID !== undefined) {
        gameIDTOUCRGameData.get(clientData.gameID)!.clientIDs.add(clientData.clientID);
      }

      clientIDs.add(clientData.clientID);
    });

    userIDToUCRUser.set(userData.userID, new UCRUser(userData.userID, userData.username, clientIDs, 0));
  });

  gameDataDatas.forEach((gameDataData) => {
    gameDataData.userIDs.forEach((userID) => {
      const ucrUser = userIDToUCRUser.get(userID);

      if (ucrUser !== undefined) {
        ucrUser.numGames++;
      } else {
        fail('user in a game but not in users map');
      }
    });
  });

  expect(uncircularreferenceifyClientIDToClient(clientManager.clientIDToClient)).toEqual(clientIDToUCRClient);
  expect(uncircularreferenceifyUserIDToUser(clientManager.userIDToUser)).toEqual(userIDToUCRUser);
  expect(uncircularreferenceifyGameIDToGameData(clientManager.gameIDToGameData)).toEqual(gameIDTOUCRGameData);
  expect(uncircularreferenceifyGameIDToGameData(clientManager.gameDisplayNumberToGameData)).toEqual(gameDisplayNumberTOUCRGameData);
}

function uncircularreferenceifyClientIDToClient(clientIDToClient: Map<number, Client>) {
  const clientIDToUCRClient: ClientIDToUCRClient = new Map();

  clientIDToClient.forEach((client, clientID) => {
    const gameID = client.gameData !== null ? client.gameData.id : null;

    clientIDToUCRClient.set(clientID, new UCRClient(client.id, gameID, client.user.id));
  });

  return clientIDToUCRClient;
}

function uncircularreferenceifyUserIDToUser(userIDToUser: Map<number, User>) {
  const userIDToUCRUser: UserIDToUCRUser = new Map();

  userIDToUser.forEach((user, userID) => {
    const clientIDs = new Set<number>();

    user.clients.forEach((client) => {
      clientIDs.add(client.id);
    });

    userIDToUCRUser.set(userID, new UCRUser(user.id, user.name, clientIDs, user.numGames));
  });

  return userIDToUCRUser;
}

function uncircularreferenceifyGameIDToGameData(gameIDToGameData: Map<number, GameData>) {
  const gameIDTOUCRGameData: GameIDTOUCRGameData = new Map();

  gameIDToGameData.forEach((gameData, gameID) => {
    let userIDs: Set<number>;
    if (gameData.gameSetup !== null) {
      userIDs = gameData.gameSetup.userIDsSet;
    } else {
      userIDs = new Set(gameData.game!.userIDs);
    }

    const ucrGameData = new UCRGameData(gameData.id, gameData.displayNumber, userIDs);

    gameData.clients.forEach((client) => {
      ucrGameData.clientIDs.add(client.id);
    });

    gameIDTOUCRGameData.set(gameID, ucrGameData);
  });

  return gameIDTOUCRGameData;
}

function sendsMessageWhenConnected(handlerCallback: (clientManager: ClientManager) => void, expectedMessage: any[]) {
  const { clientManager, testConnection } = getClientManagerAndStuff();

  clientManager.onSubmitLoginForm('me', '');
  testConnection.triggerOpen();
  testConnection.clearSentMessages();

  handlerCallback(clientManager);

  expect(testConnection.sentMessages.length).toBe(1);
  expect(testConnection.sentMessages[0]).toEqual(expectedMessage);
}

function doesNotSendMessageWhenNotConnected(handlerCallback: (clientManager: ClientManager) => void) {
  const { clientManager, testConnection } = getClientManagerAndStuff();

  clientManager.onSubmitLoginForm('me', '');
  testConnection.triggerOpen();
  testConnection.triggerClose();
  testConnection.clearSentMessages();

  handlerCallback(clientManager);

  expect(testConnection.sentMessages.length).toBe(0);
}

describe('onSubmitLoginForm', () => {
  test('connection is instantiated and first message is sent', () => {
    const { clientManager, testConnection, renderMock } = getClientManagerAndStuff();

    expect(clientManager.page).toBe(ClientManagerPage.Login);
    expect(renderMock.mock.calls.length).toBe(1);

    clientManager.onSubmitLoginForm('username', 'password');

    expect(clientManager.page).toBe(ClientManagerPage.Connecting);
    expect(clientManager.socket).toBe(testConnection);
    if (clientManager.socket !== null) {
      expect(testConnection.onopen).toBe(clientManager.onSocketOpen);
      expect(testConnection.onmessage).toBe(clientManager.onSocketMessage);
      expect(testConnection.onclose).toBe(clientManager.onSocketClose);
    }
    expect(renderMock.mock.calls.length).toBe(2);
    expect(testConnection.sentMessages).toEqual([]);

    testConnection.triggerOpen();

    expect(renderMock.mock.calls.length).toBe(2);
    expect(testConnection.sentMessages).toEqual([[0, 'username', 'password', []]]);
  });

  test('goes back to login page upon fatal error followed by a closed connection', () => {
    const { clientManager, testConnection, renderMock } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('username', 'password');

    testConnection.triggerOpen();

    testConnection.triggerMessage([[MessageToClient.FatalError, ErrorCode.IncorrectPassword]]);

    expect(clientManager.errorCode).toBe(ErrorCode.IncorrectPassword);
    expect(clientManager.page).toBe(ClientManagerPage.Connecting);
    expect(renderMock.mock.calls.length).toBe(3);

    testConnection.triggerClose();

    expect(clientManager.errorCode).toBe(ErrorCode.IncorrectPassword);
    expect(clientManager.page).toBe(ClientManagerPage.Login);
    expect(renderMock.mock.calls.length).toBe(4);
  });

  test('goes back to login page upon closed connection before receiving a message', () => {
    const { clientManager, testConnection, renderMock } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('username', 'password');

    testConnection.triggerClose();

    expect(clientManager.errorCode).toBe(ErrorCode.CouldNotConnect);
    expect(clientManager.page).toBe(ClientManagerPage.Login);
    expect(renderMock.mock.calls.length).toBe(3);
  });

  test('goes to the lobby page upon receiving the Greeting message', () => {
    const { clientManager, testConnection, renderMock } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('user', '');

    testConnection.triggerOpen();

    testConnection.triggerMessage([[MessageToClient.Greetings, 1, [[1, 'user', [[1]]]], []]]);

    expect(clientManager.errorCode).toBe(null);
    expect(clientManager.page).toBe(ClientManagerPage.Lobby);
    expect(clientManager.myClient).toBe(clientManager.clientIDToClient.get(1));
    expectClientAndUserAndGameData(clientManager, [new UserData(1, 'user', [new ClientData(1)])], []);
    expect(renderMock.mock.calls.length).toBe(3);
  });
});

describe('onSubmitCreateGame', () => {
  test('sends CreateGame message when connected', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.clearSentMessages();

    clientManager.onSubmitCreateGame(GameMode.TEAMS_2_VS_2);

    expect(testConnection.sentMessages.length).toBe(1);
    expect(testConnection.sentMessages[0]).toEqual([MessageToServer.CreateGame, GameMode.TEAMS_2_VS_2]);
  });

  test('does not send CreateGame message when not connected', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerClose();
    testConnection.clearSentMessages();

    clientManager.onSubmitCreateGame(GameMode.TEAMS_2_VS_2);

    expect(testConnection.sentMessages.length).toBe(0);
  });
});

describe('onEnterClicked', () => {
  test('sends EnterGame message when connected', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 0, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);
    testConnection.clearSentMessages();

    clientManager.gameDisplayNumberToGameData.get(1)!.onEnterClicked();

    expect(testConnection.sentMessages.length).toBe(1);
    expect(testConnection.sentMessages[0]).toEqual([MessageToServer.EnterGame, 1]);
  });

  test('does not send EnterGame message when not connected', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 0, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);
    testConnection.triggerClose();
    testConnection.clearSentMessages();

    clientManager.gameDisplayNumberToGameData.get(1)!.onEnterClicked();

    expect(testConnection.sentMessages.length).toBe(0);
  });
});

describe('onExitGameClicked', () => {
  test('sends ExitGame message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onExitGameClicked(), [MessageToServer.ExitGame]);
  });

  test('does not send ExitGame message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onExitGameClicked());
  });
});

describe('onJoinGame', () => {
  test('sends JoinGame message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onJoinGame(), [MessageToServer.JoinGame]);
  });

  test('does not send JoinGame message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onJoinGame());
  });
});

describe('onUnjoinGame', () => {
  test('sends UnjoinGame message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onUnjoinGame(), [MessageToServer.UnjoinGame]);
  });

  test('does not send UnjoinGame message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onUnjoinGame());
  });
});

describe('onApproveOfGameSetup', () => {
  test('sends ApproveOfGameSetup message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onApproveOfGameSetup(), [MessageToServer.ApproveOfGameSetup]);
  });

  test('does not send ApproveOfGameSetup message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onApproveOfGameSetup());
  });
});

describe('onChangeGameMode', () => {
  test('sends ChangeGameMode message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onChangeGameMode(GameMode.TEAMS_2_VS_2), [
      MessageToServer.ChangeGameMode,
      GameMode.TEAMS_2_VS_2,
    ]);
  });

  test('does not send ChangeGameMode message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onChangeGameMode(GameMode.TEAMS_2_VS_2));
  });
});

describe('onChangePlayerArrangementMode', () => {
  test('sends ChangePlayerArrangementMode message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onChangePlayerArrangementMode(PlayerArrangementMode.EXACT_ORDER), [
      MessageToServer.ChangePlayerArrangementMode,
      PlayerArrangementMode.EXACT_ORDER,
    ]);
  });

  test('does not send ChangePlayerArrangementMode message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onChangePlayerArrangementMode(PlayerArrangementMode.EXACT_ORDER));
  });
});

describe('onSwapPositions', () => {
  test('sends SwapPositions message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onSwapPositions(0, 1), [MessageToServer.SwapPositions, 0, 1]);
  });

  test('does not send SwapPositions message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onSwapPositions(0, 1));
  });
});

describe('onKickUser', () => {
  test('sends KickUser message when connected', () => {
    sendsMessageWhenConnected((clientManager) => clientManager.onKickUser(5), [MessageToServer.KickUser, 5]);
  });

  test('does not send KickUser message when not connected', () => {
    doesNotSendMessageWhenNotConnected((clientManager) => clientManager.onKickUser(5));
  });
});

describe('MessageToClient.Greetings', () => {
  test('message is processed correctly (1)', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    const gameSetupJSON1 = [GameMode.TEAMS_3_VS_3, PlayerArrangementMode.RANDOM_ORDER, 4, [4, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]];
    const gameSetupJSON2 = [GameMode.SINGLES_2, PlayerArrangementMode.EXACT_ORDER, 5, [9, 5], [0, 1]];
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        7,
        [
          [1, 'user 1', [[1], [6]]],
          [2, 'user 2', [[2], [3]]],
          [3, 'user 3', [[4]]],
          [4, 'user 4', [[5, 1]]],
          [5, 'me', [[7]]],
          [9, 'user 9'],
        ],
        [
          [0, 1, 1, ...gameSetupJSON1],
          [0, 2, 3, ...gameSetupJSON2],
        ],
      ],
    ]);

    expect(clientManager.userIDToUser.get(1)!.numGames).toBe(0);
    expect(clientManager.userIDToUser.get(2)!.numGames).toBe(0);
    expect(clientManager.userIDToUser.get(3)!.numGames).toBe(0);
    expect(clientManager.userIDToUser.get(4)!.numGames).toBe(1);
    expect(clientManager.userIDToUser.get(5)!.numGames).toBe(1);
    expect(clientManager.userIDToUser.get(9)!.numGames).toBe(1);
    expect(clientManager.myClient).toBe(clientManager.clientIDToClient.get(7));
    expect(clientManager.gameIDToGameData.get(1)!.gameSetup!.toJSON()).toEqual(gameSetupJSON1);
    expect(clientManager.gameIDToGameData.get(2)!.gameSetup!.toJSON()).toEqual(gameSetupJSON2);
    expectClientAndUserAndGameData(
      clientManager,
      [
        new UserData(1, 'user 1', [new ClientData(1), new ClientData(6)]),
        new UserData(2, 'user 2', [new ClientData(2), new ClientData(3)]),
        new UserData(3, 'user 3', [new ClientData(4)]),
        new UserData(4, 'user 4', [new ClientData(5, 1)]),
        new UserData(5, 'me', [new ClientData(7)]),
        new UserData(9, 'user 9', []),
      ],
      [new GameDataData(1, 1, [4]), new GameDataData(2, 3, [5, 9])],
    );
  });

  test('message is processed correctly (2)', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('2', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        4,
        [
          [1, '1', [[1, 1]]],
          [2, '2', [[2, 2], [4]]],
          [3, '3', [[3]]],
        ],
        [
          [0, 10, 1, GameMode.SINGLES_4, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 0, 0, 0], [0, 0, 0, 0]],
          [
            1,
            11,
            2,
            [
              [[], 1234567894, [], [89, 19, 29, 39, 49, 59, 69], 0],
              [[19], 1, [], [79], 0],
              [[29], 1, [], [0], 0],
              [[39], 1, [], [99], 0],
            ],
            GameMode.SINGLES_1,
            PlayerArrangementMode.RANDOM_ORDER,
            2,
            [2],
          ],
        ],
      ],
    ]);

    expect(clientManager.userIDToUser.get(1)!.numGames).toBe(1);
    expect(clientManager.userIDToUser.get(2)!.numGames).toBe(1);
    expect(clientManager.userIDToUser.get(3)!.numGames).toBe(0);
    expect(clientManager.myClient).toBe(clientManager.clientIDToClient.get(4));
    const game = clientManager.gameIDToGameData.get(11)!.game!;
    expect(game).toBeDefined();
    expect(game.gameMode).toBe(GameMode.SINGLES_1);
    expect(game.hostUserID).toBe(2);
    expect(game.moveDataHistory.size).toBe(4);
    expect(game.myUserID).toBe(2);
    expect(game.playerArrangementMode).toBe(PlayerArrangementMode.RANDOM_ORDER);
    expect(game.userIDs).toEqual(List([2]));
    expect(game.usernames).toEqual(List(['2']));
    expectClientAndUserAndGameData(
      clientManager,
      [
        new UserData(1, '1', [new ClientData(1, 10)]),
        new UserData(2, '2', [new ClientData(2, 11), new ClientData(4)]),
        new UserData(3, '3', [new ClientData(3)]),
      ],
      [new GameDataData(10, 1, [1]), new GameDataData(11, 2, [2])],
    );
  });
});

describe('MessageToClient.ClientConnected', () => {
  test('new user and client added', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);

    expectClientAndUserAndGameData(clientManager, [new UserData(1, 'me', [new ClientData(2)]), new UserData(3, 'user 3', [new ClientData(4)])], []);
  });

  test('client added for existing user', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 5, 3]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'me', [new ClientData(2)]), new UserData(3, 'user 3', [new ClientData(4), new ClientData(5)])],
      [],
    );
  });
});

describe('MessageToClient.ClientDisconnected', () => {
  test('sole client of a user disconnects', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);
    testConnection.triggerMessage([[MessageToClient.ClientDisconnected, 4]]);

    expectClientAndUserAndGameData(clientManager, [new UserData(1, 'me', [new ClientData(2)])], []);
  });

  test('a client of a user disconnects, leaving another client still connected', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 5, 3]]);
    testConnection.triggerMessage([[MessageToClient.ClientDisconnected, 4]]);

    expectClientAndUserAndGameData(clientManager, [new UserData(1, 'me', [new ClientData(2)]), new UserData(3, 'user 3', [new ClientData(5)])], []);
  });

  test('user is not deleted if they are in a game', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);
    testConnection.triggerMessage([[MessageToClient.GameCreated, 10, 1, GameMode.TEAMS_2_VS_2, 4]]);
    testConnection.triggerMessage([[MessageToClient.ClientDisconnected, 4]]);

    expect(clientManager.userIDToUser.get(3)!.numGames).toBe(1);
    expectClientAndUserAndGameData(clientManager, [new UserData(1, 'me', [new ClientData(2)]), new UserData(3, 'user 3', [])], [new GameDataData(10, 1, [3])]);
  });
});

describe('MessageToClient.GameCreated', () => {
  test('game is added', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);
    testConnection.triggerMessage([[MessageToClient.GameCreated, 10, 1, GameMode.TEAMS_2_VS_2, 2]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'me', [new ClientData(2)]), new UserData(3, 'user 3', [new ClientData(4)])],
      [new GameDataData(10, 1, [1])],
    );

    expect(clientManager.userIDToUser.get(1)!.numGames).toBe(1);
    const gameSetup = clientManager.gameIDToGameData.get(10)!.gameSetup!;
    expect(gameSetup.gameMode).toBe(GameMode.TEAMS_2_VS_2);
    expect(gameSetup.playerArrangementMode).toBe(PlayerArrangementMode.RANDOM_ORDER);
    expect(gameSetup.hostUserID).toBe(1);
    expect(gameSetup.hostUsername).toBe('me');
  });
});

describe('MessageToClient.ClientEnteredGame', () => {
  test('own client enters game', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);
    testConnection.triggerMessage([
      [MessageToClient.GameCreated, 10, 1, GameMode.TEAMS_2_VS_2, 2],
      [MessageToClient.ClientEnteredGame, 2, 1],
    ]);

    expect(clientManager.page).toBe(ClientManagerPage.GameSetup);
    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'me', [new ClientData(2, 10)]), new UserData(3, 'user 3', [new ClientData(4)])],
      [new GameDataData(10, 1, [1])],
    );
  });

  test('other client enters game', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([[MessageToClient.Greetings, 2, [[1, 'me', [[2]]]], []]]);
    testConnection.triggerMessage([[MessageToClient.ClientConnected, 4, 3, 'user 3']]);
    testConnection.triggerMessage([
      [MessageToClient.GameCreated, 10, 1, GameMode.TEAMS_2_VS_2, 4],
      [MessageToClient.ClientEnteredGame, 4, 1],
    ]);

    expect(clientManager.page).toBe(ClientManagerPage.Lobby);
    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'me', [new ClientData(2)]), new UserData(3, 'user 3', [new ClientData(4, 10)])],
      [new GameDataData(10, 1, [3])],
    );
  });
});

describe('MessageToClient.ClientExitedGame', () => {
  test('own client exits game', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);

    expect(clientManager.page).toBe(ClientManagerPage.GameSetup);
    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.ClientExitedGame, 2]]);

    expect(clientManager.page).toBe(ClientManagerPage.Lobby);
    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2)])],
      [new GameDataData(10, 1, [1, 2])],
    );
  });

  test('other client exits game', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);

    expect(clientManager.page).toBe(ClientManagerPage.GameSetup);
    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.ClientExitedGame, 1]]);

    expect(clientManager.page).toBe(ClientManagerPage.GameSetup);
    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );
  });
});

describe('MessageToClient.GameSetupChanged', () => {
  test('UserAdded message is processed correctly', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 0, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1])],
    );

    testConnection.triggerMessage([[MessageToClient.GameSetupChanged, 1, GameSetupChange.UserAdded, 2]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );
    expect(clientManager.gameIDToGameData.get(10)!.gameSetup!.userIDs.toJS()).toEqual([1, 2, null, null]);
  });

  test('UserRemoved message is processed correctly', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.GameSetupChanged, 1, GameSetupChange.UserRemoved, 2]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1])],
    );
    expect(clientManager.gameIDToGameData.get(10)!.gameSetup!.userIDs.toJS()).toEqual([1, null, null, null]);
  });

  test('UserApprovedOfGameSetup message is processed correctly', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.SINGLES_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2], [0, 0]]],
      ],
    ]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.GameSetupChanged, 1, GameSetupChange.UserApprovedOfGameSetup, 2]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );
    expect(clientManager.gameIDToGameData.get(10)!.gameSetup!.approvals.toJS()).toEqual([false, true]);
  });

  test('GameModeChanged message is processed correctly', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.SINGLES_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2], [0, 0]]],
      ],
    ]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.GameSetupChanged, 1, GameSetupChange.GameModeChanged, GameMode.SINGLES_3]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );
    expect(clientManager.gameIDToGameData.get(10)!.gameSetup!.gameMode).toEqual(GameMode.SINGLES_3);
  });

  test('PlayerArrangementModeChanged message is processed correctly', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.SINGLES_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2], [0, 0]]],
      ],
    ]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.GameSetupChanged, 1, GameSetupChange.PlayerArrangementModeChanged, PlayerArrangementMode.EXACT_ORDER]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );
    expect(clientManager.gameIDToGameData.get(10)!.gameSetup!.playerArrangementMode).toEqual(PlayerArrangementMode.EXACT_ORDER);
  });

  test('PositionsSwapped message is processed correctly', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.GameSetupChanged, 1, GameSetupChange.PositionsSwapped, 0, 1]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );
    expect(clientManager.gameIDToGameData.get(10)!.gameSetup!.userIDs.toJS()).toEqual([2, 1, null, null]);
  });

  test('UserKicked message is processed correctly', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        2,
        [
          [1, 'user 1', [[1, 1]]],
          [2, 'me', [[2, 1]]],
        ],
        [[0, 10, 1, GameMode.TEAMS_2_VS_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2, 0, 0], [0, 0, 0, 0]]],
      ],
    ]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    testConnection.triggerMessage([[MessageToClient.GameSetupChanged, 1, GameSetupChange.UserKicked, 2]]);

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'user 1', [new ClientData(1, 10)]), new UserData(2, 'me', [new ClientData(2, 10)])],
      [new GameDataData(10, 1, [1])],
    );
    expect(clientManager.gameIDToGameData.get(10)!.gameSetup!.userIDs.toJS()).toEqual([1, null, null, null]);
  });
});

describe('MessageToClient.GameStarted and MessageToClient.GameActionDone', () => {
  test('messages are processed correctly when not in the game', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('me', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [
        MessageToClient.Greetings,
        3,
        [
          [1, 'host', [[1, 1]]],
          [2, 'opponent', [[2, 1]]],
          [3, 'me', [[3]]],
        ],
        [[0, 10, 1, GameMode.SINGLES_2, PlayerArrangementMode.RANDOM_ORDER, 1, [1, 2], [1, 0]]],
      ],
    ]);
    testConnection.triggerMessage([
      [MessageToClient.GameStarted, 1, [2, 1]],
      [MessageToClient.GameActionDone, 1, [], 123456789, [], [89, 19, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1], 0],
    ]);

    expect(clientManager.page).toBe(ClientManagerPage.Lobby);
    expect(clientManager.myRequiredGameAction).toBeNull();

    expectClientAndUserAndGameData(
      clientManager,
      [new UserData(1, 'host', [new ClientData(1, 10)]), new UserData(2, 'opponent', [new ClientData(2, 10)]), new UserData(3, 'me', [new ClientData(3)])],
      [new GameDataData(10, 1, [1, 2])],
    );

    expect(clientManager.userIDToUser.get(1)!.numGames).toBe(1);
    const game = clientManager.gameIDToGameData.get(10)!.game!;
    expect(game.gameMode).toBe(GameMode.SINGLES_2);
    expect(game.playerArrangementMode).toBe(PlayerArrangementMode.RANDOM_ORDER);
    expect(game.hostUserID).toBe(1);
  });

  test('messages are processed correctly when in the game', () => {
    const { clientManager, testConnection } = getClientManagerAndStuff();

    clientManager.onSubmitLoginForm('user', '');
    testConnection.triggerOpen();
    testConnection.triggerMessage([
      [MessageToClient.Greetings, 2, [[1, 'user', [[2]]]], [[0, 1, 1, GameMode.SINGLES_1, PlayerArrangementMode.RANDOM_ORDER, 1, [1], [0]]]],
    ]);
    testConnection.triggerMessage([[MessageToClient.ClientEnteredGame, 2, 1]]);
    testConnection.triggerMessage([
      [MessageToClient.GameStarted, 1, [1]],
      [MessageToClient.GameActionDone, 1, [], 1550799393696, [], [65, 3, 34, 6, 46, 10, 78], 0],
    ]);

    expect(clientManager.page).toBe(ClientManagerPage.Game);
    expect(clientManager.myRequiredGameAction).toBe(GameAction.PlayTile);

    expectClientAndUserAndGameData(clientManager, [new UserData(1, 'user', [new ClientData(2, 1)])], [new GameDataData(1, 1, [1])]);

    expect(clientManager.userIDToUser.get(1)!.numGames).toBe(1);
    const game = clientManager.gameIDToGameData.get(1)!.game!;
    expect(game.gameMode).toBe(GameMode.SINGLES_1);
    expect(game.playerArrangementMode).toBe(PlayerArrangementMode.RANDOM_ORDER);
    expect(game.hostUserID).toBe(1);
  });
});
