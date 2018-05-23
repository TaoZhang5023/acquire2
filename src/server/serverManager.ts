import { Connection, Server } from 'sockjs';
import { ErrorCode, MessageToClient } from '../common/enums';
import { isASCII } from '../common/helpers';
import { ReuseIDManager } from './reuseIDManager';
import { UserDataProvider } from './userDataProvider';

export enum ConnectionState {
    WaitingForFirstMessage,
    ProcessingFirstMessage,
    LoggedIn,
}

export class ServerManager {
    connectionIDToConnectionState: Map<string, ConnectionState> = new Map();

    connectionIDToPreLoggedInConnection: Map<string, Connection> = new Map();

    clientIDManager: ReuseIDManager = new ReuseIDManager(60000);
    connectionIDToClient: Map<string, Client> = new Map();
    userIDToUser: Map<number, User> = new Map();

    constructor(public server: Server, public userDataProvider: UserDataProvider, public nextInternalGameID: number) {}

    manage() {
        this.server.on('connection', connection => {
            this.addConnection(connection);

            connection.on('data', messageString => {
                let message: any[];
                try {
                    message = JSON.parse(messageString);
                } catch (error) {
                    this.kickWithError(connection, ErrorCode.InvalidMessageFormat);
                    return;
                }

                if (!Array.isArray(message)) {
                    this.kickWithError(connection, ErrorCode.InvalidMessageFormat);
                    return;
                }

                const connectionState = this.connectionIDToConnectionState.get(connection.id);

                if (connectionState === ConnectionState.WaitingForFirstMessage) {
                    this.connectionIDToConnectionState.set(connection.id, ConnectionState.ProcessingFirstMessage);

                    // tslint:disable-next-line:no-floating-promises
                    this.processFirstMessage(connection, message);
                }
            });

            connection.on('close', () => {
                this.removeConnection(connection);
            });
        });
    }

    addConnection(connection: Connection) {
        this.connectionIDToConnectionState.set(connection.id, ConnectionState.WaitingForFirstMessage);
        this.connectionIDToPreLoggedInConnection.set(connection.id, connection);
    }

    removeConnection(connection: Connection) {
        const connectionState = this.connectionIDToConnectionState.get(connection.id);
        if (connectionState === undefined) {
            return;
        }

        this.connectionIDToConnectionState.delete(connection.id);

        if (connectionState === ConnectionState.LoggedIn) {
            const client = this.connectionIDToClient.get(connection.id);
            if (client === undefined) {
                return;
            }

            this.clientIDManager.returnID(client.id);

            this.connectionIDToClient.delete(connection.id);

            const user = client.user;
            user.clients.delete(client);
            if (user.clients.size === 0) {
                this.userIDToUser.delete(user.id);
            }
        } else {
            this.connectionIDToPreLoggedInConnection.delete(connection.id);
        }
    }

    kickWithError(connection: Connection, errorCode: ErrorCode) {
        connection.write(JSON.stringify([[MessageToClient.FatalError, errorCode]]));
        connection.close();
    }

    async processFirstMessage(connection: Connection, message: any[]) {
        if (message.length !== 4) {
            this.kickWithError(connection, ErrorCode.InvalidMessageFormat);
            return;
        }

        const version: number = message[0];
        if (version !== 0) {
            this.kickWithError(connection, ErrorCode.NotUsingLatestVersion);
            return;
        }

        const username: string = message[1];
        if (username.length === 0 || username.length > 32 || !isASCII(username)) {
            this.kickWithError(connection, ErrorCode.InvalidUsername);
            return;
        }

        const password: string = message[2];
        if (typeof password !== 'string') {
            this.kickWithError(connection, ErrorCode.InvalidMessageFormat);
            return;
        }

        const gameDataArray: any[] = message[3];
        if (!Array.isArray(gameDataArray)) {
            this.kickWithError(connection, ErrorCode.InvalidMessageFormat);
            return;
        }

        let userData;
        try {
            userData = await this.userDataProvider.lookupUser(username);
        } catch (error) {
            this.kickWithError(connection, ErrorCode.InternalServerError);
            return;
        }

        let userID = 0;

        if (userData !== null) {
            if (userData.hasPassword) {
                if (password.length === 0) {
                    this.kickWithError(connection, ErrorCode.MissingPassword);
                    return;
                } else if (!userData.verifyPassword(password)) {
                    this.kickWithError(connection, ErrorCode.IncorrectPassword);
                    return;
                } else {
                    userID = userData.userID;
                }
            } else {
                if (password.length > 0) {
                    this.kickWithError(connection, ErrorCode.ProvidedPassword);
                    return;
                } else {
                    userID = userData.userID;
                }
            }
        } else {
            if (password.length > 0) {
                this.kickWithError(connection, ErrorCode.ProvidedPassword);
                return;
            } else {
                try {
                    userID = await this.userDataProvider.createUser(username, null);
                } catch (error) {
                    this.kickWithError(connection, ErrorCode.InternalServerError);
                    return;
                }
            }
        }

        this.connectionIDToConnectionState.set(connection.id, ConnectionState.LoggedIn);

        this.connectionIDToPreLoggedInConnection.delete(connection.id);

        let user = this.userIDToUser.get(userID);
        if (user === undefined) {
            user = new User(userID);
            this.userIDToUser.set(userID, user);
        }

        const client = new Client(this.clientIDManager.getID(), connection, user);
        this.connectionIDToClient.set(connection.id, client);
        user.clients.add(client);
    }
}

export class Client {
    constructor(public id: number, public connection: Connection, public user: User) {}
}

export class User {
    clients: Set<Client> = new Set();

    constructor(public id: number) {}
}
